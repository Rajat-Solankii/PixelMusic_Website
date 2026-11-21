# PixelMusic website

Source for **[www.pixelmusic.me](https://www.pixelmusic.me)**, the landing page for
[PixelMusic](https://github.com/ianshulyadav/PixelMusic), deployed on Vercel.

The Android app lives in the main repo: https://github.com/ianshulyadav/PixelMusic

## What's here

| Path | Purpose |
|---|---|
| `index.html` | Landing page (single file: HTML, CSS, JS) |
| `assets/site/` | Screenshots, icons and font used by the page |
| `stats.json` | Download/star counts shown on the page, refreshed daily |
| `tools/stats/` + `.github/workflows/update-stats.yml` | Daily job that updates `stats.json` |
| `api/wishes.js`, `wishes/` | Birthday wishes wall and API, see [WISHES_SETUP.md](WISHES_SETUP.md) |

## Local preview

Any static server works for the landing page, e.g. `npx serve .`
The `/api` routes need `vercel dev` and the Upstash env vars.

## License

GPL-3.0, see [LICENSE](LICENSE).
