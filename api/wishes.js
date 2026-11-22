// Birthday wishes API for www.pixelmusic.me (Vercel Serverless Function, Node 18+).
//
//   GET    /api/wishes            -> { count, wishes: [{ id, name, message, platform, createdAt }] }
//   POST   /api/wishes            -> { wish }      body: { name?, message, platform?, appVersion?, website? }
//   DELETE /api/wishes?id=<id>    -> { ok: true }  permanently deletes, header: Authorization: Bearer <WISHES_ADMIN_PASSWORD>
//   GET    /api/wishes?admin=1    -> same as GET, password required (admin page sign-in)
//   GET    /api/wishes?config=1   -> { mode: "auto" | "on" | "off", date: "MM-DD" }  birthday mode (website + app)
//   PUT    /api/wishes?config=1   -> { mode, date }  body: { mode?, date? }, password required
//          GET ?config=1 also returns `announcements` (newest first: { id, title, message,
//          buttonLabel, buttonUrl, until, publishedAt }) and `announcement` (the newest, or null).
//   PUT    /api/wishes?announcement=1     -> publish   body: { title, message, buttonLabel?, buttonUrl?, until? }
//   DELETE /api/wishes?announcement=<id>  -> delete that announcement (both password required)
//
// Storage: Upstash Redis over its REST API (no npm dependencies). Add "Upstash for Redis"
// from the Vercel Storage tab; it injects KV_REST_API_URL / KV_REST_API_TOKEN (or the
// UPSTASH_REDIS_REST_* names, both are supported).
//
// Env vars:
//   KV_REST_API_URL / UPSTASH_REDIS_REST_URL       (required)
//   KV_REST_API_TOKEN / UPSTASH_REDIS_REST_TOKEN   (required)
//   WISHES_ADMIN_PASSWORD   admin page password (required to delete wishes and switch birthday mode)
//   WISHES_SALT        optional, salts the hashed IP used only for rate limiting

const crypto = require("crypto");

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
// WISHES_ADMIN_KEY is the old name, still accepted so an existing setup keeps working.
const ADMIN_KEY = process.env.WISHES_ADMIN_PASSWORD || process.env.WISHES_ADMIN_KEY || "";
const SALT = process.env.WISHES_SALT || REDIS_TOKEN || "pixelmusic";

const PREFIX = "bday:anshul:";
const INDEX_KEY = PREFIX + "index"; // sorted set: id -> createdAt
const wishKey = (id) => PREFIX + "wish:" + id;

const MAX_NAME = 40;
const MAX_MESSAGE = 280;
const MIN_MESSAGE = 2;
const RATE_LIMIT_PER_HOUR = 20; // per hashed IP; generous because Jio/Airtel CGNAT shares IPs
const DEFAULT_NAME = "A PixelMusic listener";
const SITE_ORIGIN = "https://www.pixelmusic.me";

// Small, deliberately conservative filter. Admins can delete anything it misses.
const BLOCKED_WORDS = [
  "fuck", "fucking", "shit", "bitch", "bastard", "asshole", "dick", "cunt", "slut", "whore",
  "nigger", "nigga", "faggot", "retard", "madarchod", "behenchod", "bhenchod", "chutiya",
  "chutiye", "gandu", "bhosdike", "bhosdi", "randi", "lund", "lavde", "harami",
];
const BLOCKED_RE = new RegExp("(^|[^a-z])(" + BLOCKED_WORDS.join("|") + ")([^a-z]|$)", "i");
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|xyz|io|me|in|ru|top|link|click)\b)/i;

async function redis(commands) {
  const res = await fetch(REDIS_URL.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + REDIS_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error("Redis HTTP " + res.status);
  const out = await res.json();
  return out.map((r) => {
    if (r.error) throw new Error("Redis: " + r.error);
    return r.result;
  });
}

function clean(text, max) {
  return String(text || "")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(req.headers["x-real-ip"] || "") || "unknown";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(SALT + "|" + ip).digest("hex").slice(0, 32);
}

function isAdmin(req) {
  if (!ADMIN_KEY) return false;
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024) throw new Error("too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function listWishes(limit) {
  const [ids] = await redis([["ZREVRANGE", INDEX_KEY, "0", String(limit - 1)]]);
  if (!ids || ids.length === 0) {
    const [count] = await redis([["ZCARD", INDEX_KEY]]);
    return { count: count || 0, wishes: [] };
  }
  const [raw, count] = await redis([["MGET", ...ids.map(wishKey)], ["ZCARD", INDEX_KEY]]);
  const wishes = raw
    .filter(Boolean)
    .map((s) => {
      try {
        const w = JSON.parse(s);
        return { id: w.id, name: w.name, message: w.message, platform: w.platform, createdAt: w.createdAt };
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
  return { count: count || wishes.length, wishes };
}

async function createWish(req, res) {
  let body;
  try {
    body = await readBody(req);
  } catch (_) {
    return send(res, 400, { error: "invalid_body" });
  }

  // Honeypot: real users never fill the hidden "website" field.
  if (body.website) return send(res, 201, { wish: null });

  const name = clean(body.name, MAX_NAME).replace(/\n/g, " ") || DEFAULT_NAME;
  const message = clean(body.message, MAX_MESSAGE);
  const platform = body.platform === "android" ? "android" : "web";

  if (message.length < MIN_MESSAGE) return send(res, 422, { error: "message_required" });
  if (BLOCKED_RE.test(message) || BLOCKED_RE.test(name)) return send(res, 422, { error: "not_kind" });
  if (LINK_RE.test(message) || LINK_RE.test(name)) return send(res, 422, { error: "no_links" });

  const rlKey = PREFIX + "rl:" + hashIp(clientIp(req));
  const [hits] = await redis([["INCR", rlKey], ["EXPIRE", rlKey, "3600", "NX"]]);
  if (hits > RATE_LIMIT_PER_HOUR) return send(res, 429, { error: "slow_down" });

  const createdAt = Date.now();
  const id = createdAt.toString(36) + crypto.randomBytes(4).toString("hex");
  const wish = {
    id,
    name,
    message,
    platform,
    appVersion: clean(body.appVersion, 32) || undefined,
    createdAt,
  };
  await redis([
    ["SET", wishKey(id), JSON.stringify(wish)],
    ["ZADD", INDEX_KEY, String(createdAt), id],
  ]);
  return send(res, 201, { wish: { id, name, message, platform, createdAt } });
}

const ADMIN_MAX_FAILS_PER_HOUR = 10;

/**
 * Verifies the admin password (WISHES_ADMIN_PASSWORD) from `Authorization: Bearer <password>`.
 * After 10 wrong attempts from one IP in an hour, that IP is locked out for the hour.
 * Returns null when OK, otherwise the error response has already been sent.
 */
async function requireAdmin(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!ADMIN_KEY) return send(res, 503, { error: "admin_not_configured" });
  const failKey = PREFIX + "adminfail:" + hashIp(clientIp(req));
  const [fails] = await redis([["GET", failKey]]);
  if (Number(fails) >= ADMIN_MAX_FAILS_PER_HOUR) return send(res, 429, { error: "locked" });
  if (isAdmin(req)) return null;
  await redis([["INCR", failKey], ["EXPIRE", failKey, "3600", "NX"]]);
  return send(res, 401, { error: "unauthorized" });
}

// Birthday mode, shared by the website and the Android app:
//   mode "auto" = only on `date` (MM-DD, every year), "on" = now, "off" = never.
const MODE_KEY = PREFIX + "mode";
const DATE_KEY = PREFIX + "date";
const MODES = ["auto", "on", "off"];
const DEFAULT_DATE = "12-14";
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function validDate(d) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(d || ""));
  if (!m) return false;
  const month = +m[1], day = +m[2];
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

// App announcements, newest first (up to MAX_ANNOUNCEMENTS). The Android app keeps them in
// its announcements inbox, notifies users about new ones and shows the newest once as a popup.
// Each publish gets a new id, so republishing the same text counts as a new announcement.
const ANNOUNCEMENTS_KEY = "app:announcements";
const MAX_ANNOUNCEMENTS = 30;
const MAX_TITLE = 80;
const MAX_ANNOUNCEMENT = 600;
const MAX_BUTTON_LABEL = 30;
const MAX_URL = 300;

function readAnnouncements(raw) {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.filter((a) => a && a.id && a.title) : [];
  } catch (_) {
    return [];
  }
}

async function readConfig() {
  const [mode, date, ann] = await redis([["GET", MODE_KEY], ["GET", DATE_KEY], ["GET", ANNOUNCEMENTS_KEY]]);
  const announcements = readAnnouncements(ann);
  return {
    mode: MODES.includes(mode) ? mode : "auto",
    date: validDate(date) ? date : DEFAULT_DATE,
    announcement: announcements[0] || null, // newest, kept for older app builds
    announcements,
  };
}

async function getConfig(req, res) {
  const config = await readConfig();
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=30");
  return send(res, 200, config);
}

async function publishAnnouncement(req, res) {
  if ((await requireAdmin(req, res)) !== null) return;
  let body;
  try {
    body = await readBody(req);
  } catch (_) {
    return send(res, 400, { error: "invalid_body" });
  }
  const title = clean(body.title, MAX_TITLE).replace(/\n/g, " ");
  const message = clean(body.message, MAX_ANNOUNCEMENT);
  const buttonLabel = clean(body.buttonLabel, MAX_BUTTON_LABEL).replace(/\n/g, " ");
  const buttonUrl = String(body.buttonUrl || "").trim().slice(0, MAX_URL);
  const until = String(body.until || "").trim();

  if (!title) return send(res, 400, { error: "title_required" });
  if (!message) return send(res, 400, { error: "message_required" });
  if (buttonUrl && !/^https:\/\/[^\s"<>]+$/i.test(buttonUrl)) return send(res, 400, { error: "invalid_url" });
  if (buttonUrl && !buttonLabel) return send(res, 400, { error: "button_label_required" });
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return send(res, 400, { error: "invalid_until" });

  const announcement = {
    id: Date.now().toString(36),
    title,
    message,
    buttonLabel: buttonUrl ? buttonLabel : "",
    buttonUrl,
    until,
    publishedAt: Date.now(),
  };
  const [raw] = await redis([["GET", ANNOUNCEMENTS_KEY]]);
  const announcements = [announcement, ...readAnnouncements(raw)].slice(0, MAX_ANNOUNCEMENTS);
  await redis([["SET", ANNOUNCEMENTS_KEY, JSON.stringify(announcements)]]);
  return send(res, 200, { announcement, announcements });
}

async function deleteAnnouncement(req, res) {
  if ((await requireAdmin(req, res)) !== null) return;
  const id = String((req.query && req.query.announcement) || "").trim();
  const [raw] = await redis([["GET", ANNOUNCEMENTS_KEY]]);
  const announcements = readAnnouncements(raw).filter((a) => a.id !== id);
  await redis([["SET", ANNOUNCEMENTS_KEY, JSON.stringify(announcements)]]);
  return send(res, 200, { announcements });
}

async function setConfig(req, res) {
  if ((await requireAdmin(req, res)) !== null) return;
  let body;
  try {
    body = await readBody(req);
  } catch (_) {
    return send(res, 400, { error: "invalid_body" });
  }
  const commands = [];
  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode)) return send(res, 400, { error: "invalid_mode" });
    commands.push(["SET", MODE_KEY, body.mode]);
  }
  if (body.date !== undefined) {
    if (!validDate(body.date)) return send(res, 400, { error: "invalid_date" });
    commands.push(["SET", DATE_KEY, body.date]);
  }
  if (!commands.length) return send(res, 400, { error: "nothing_to_change" });
  await redis(commands);
  return send(res, 200, await readConfig());
}

async function adminList(req, res) {
  if ((await requireAdmin(req, res)) !== null) return;
  const data = await listWishes(300);
  return send(res, 200, data);
}

async function deleteWish(req, res) {
  if ((await requireAdmin(req, res)) !== null) return;
  const id = String((req.query && req.query.id) || "").trim();
  if (!/^[a-z0-9]{6,40}$/.test(id)) return send(res, 400, { error: "invalid_id" });
  await redis([["ZREM", INDEX_KEY, id], ["DEL", wishKey(id)]]);
  return send(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", SITE_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (!REDIS_URL || !REDIS_TOKEN) return send(res, 503, { error: "not_configured" });

  try {
    const q = req.query || {};
    if (req.method === "GET" && q.config) return await getConfig(req, res);
    if (req.method === "PUT" && q.config) return await setConfig(req, res);
    if (req.method === "PUT" && q.announcement) return await publishAnnouncement(req, res);
    if (req.method === "DELETE" && q.announcement) return await deleteAnnouncement(req, res);
    if (req.method === "GET" && q.admin) return await adminList(req, res);
    if (req.method === "GET") {
      const limit = Math.min(Math.max(parseInt((req.query && req.query.limit) || "150", 10) || 150, 1), 300);
      const data = await listWishes(limit);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=20, stale-while-revalidate=60");
      return send(res, 200, data);
    }
    if (req.method === "POST") return await createWish(req, res);
    if (req.method === "DELETE") return await deleteWish(req, res);
    res.setHeader("Allow", "GET, POST, PUT, DELETE, OPTIONS");
    return send(res, 405, { error: "method_not_allowed" });
  } catch (err) {
    console.error("[wishes]", err);
    return send(res, 500, { error: "server_error" });
  }
};
