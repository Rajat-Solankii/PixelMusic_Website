# Birthday wishes wall (www.pixelmusic.me/wishes)

Wishes sent from the Android app's December 14th popup, or from the web form, appear on
`https://www.pixelmusic.me/wishes`.

## Files (copy these into the repo Vercel deploys)

| Path | What it is |
|---|---|
| `api/wishes.js` | Vercel function: `GET` list, `POST` new wish, `DELETE ?id=` hide (admin) |
| `wishes/index.html` | Public wishes wall + "Send a wish" form + gift (Ko-fi / UPI) |
| `wishes/admin.html` | Team page to hide wishes (needs the admin key) |

No `package.json` or build step needed: the function has no dependencies.

## One-time setup in Vercel

1. **Storage → Upstash for Redis → Connect** to `pixel-music-website` (all environments).
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. **Settings → Environment Variables → add `WISHES_ADMIN_KEY`** with a long random value
   (e.g. a password-manager generated 32+ characters). Mark it *Sensitive*.
3. Redeploy, then check `https://www.pixelmusic.me/api/wishes` returns `{"count":0,"wishes":[]}`.

## Moderation

- Wishes go live instantly. The API blocks common abusive words (English + Hindi), links,
  empty messages and bots (honeypot), and allows 20 wishes per hour per IP.
- To remove one: open `/wishes/admin.html`, enter the admin key, click **Hide**.
  Hidden wishes stay in Redis (not deleted). The wall updates within ~20 seconds.

## Free tier usage

- The app sends exactly one request per wish. It never polls.
- The wall's list is cached on Vercel's CDN for 20 s, so most page views never run the
  function. Open tabs refresh every 30 s and stop after 20 minutes.
- Each wish costs 4 Redis commands; each uncached list read costs 2–3.

## API

```
POST /api/wishes   {"name":"Rajat","message":"Happy birthday!","platform":"android"}
  201 {"wish":{...}}
  422 {"error":"message_required" | "not_kind" | "no_links"}
  429 {"error":"slow_down"}
  503 {"error":"not_configured"}   (Upstash not connected yet)
```
