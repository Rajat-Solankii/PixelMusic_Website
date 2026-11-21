# Birthday mode and wishes wall

On December 14th the home page (`www.pixelmusic.me`) turns into a birthday page: a celebration
banner, the live wishes wall, a "Send a wish" form and a "Give a gift" button (opens the
site's Ko-fi / UPI Support dialog) appear at the top, with a "🎂 Wishes" link in the nav.
Wishes from the Android app's December 14th popup land on the same wall.

## Files

| Path | What it is |
|---|---|
| `birthday/birthday.js` | Decides whether birthday mode is on and builds the section (loaded by `index.html`) |
| `birthday/birthday.css` | Styles for the birthday section, loaded only when it's on |
| `api/wishes.js` | Vercel function: wishes list/add/delete and the birthday mode setting |
| `wishes/admin.html` | Password-protected admin page: birthday mode switch + delete wishes |
| `wishes/index.html` | Redirect from the old `/wishes` address to `/#wishes` |

`index.html` only has one added line: `<script src="/birthday/birthday.js" defer></script>`.
No build step or npm dependency is needed.

## One-time setup in Vercel

1. **Storage → Upstash for Redis → Connect** to `pixel-music-website` (all environments).
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. **Settings → Environment Variables → add `WISHES_ADMIN_PASSWORD`**: this is the admin
   page password. Mark it *Sensitive*. Never commit it to this (public) repo.
3. Redeploy. `https://www.pixelmusic.me/api/wishes` should return `{"count":0,"wishes":[]}`.

## Admin page: `https://www.pixelmusic.me/wishes/admin.html`

Shows only a password box until the server accepts the password (kept in memory only;
reloading or **Lock** signs out). 10 wrong passwords from one IP lock that IP out for an hour.

- **Birthday mode**
  - **Auto · Dec 14 only** (default): on during December 14th in each visitor's local time.
  - **On now**: shows the birthday page immediately, on any day.
  - **Off**: hidden, even on December 14th.
  Visitors see a change within about 30 seconds.
- **Delete** permanently removes a wish from the wall and the database. It can't be undone.

Preview the birthday page on any day, whatever the mode: `https://www.pixelmusic.me/?birthday`

## Moderation

Wishes go live instantly. The API blocks common abusive words (English + Hindi), links,
empty messages and bots (honeypot), and allows 20 wishes per hour per IP.

## Free tier usage

- The app sends one request per wish and never polls.
- The mode and wishes list are cached on Vercel's CDN (15–20 s), so most page views don't run
  the function. Open tabs refresh the wall every 30 s and stop after 20 minutes.
- Each wish costs 4 Redis commands; each uncached read costs 1–3.

## API

```
GET    /api/wishes             {count, wishes}
POST   /api/wishes             {name?, message, platform?}  -> 201 {wish} | 422 | 429 | 503
DELETE /api/wishes?id=<id>     delete a wish          (Authorization: Bearer <password>)
GET    /api/wishes?admin=1     list, password check   (Authorization: Bearer <password>)
GET    /api/wishes?config=1    {mode: "auto" | "on" | "off"}
PUT    /api/wishes?config=1    {mode}                 (Authorization: Bearer <password>)
```
