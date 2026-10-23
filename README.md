# rembytes.com

Vite + GSAP + Three.js + Lenis. The site is static files (`dist/`). The only server-side piece is the
contact form API, and it is **host-neutral**: one core, three thin adapters.

```
server/contact-core.mjs      all contact-form logic (web-standard Request/Response, no host APIs)
server/stores.mjs            file-based storage (one JSON file per message)
server/index.mjs             standalone Node server → production on our own servers
netlify/functions/contact.mjs  Netlify adapter → staging only
vite.config.js               dev middleware → `npm run dev`
```

```
npm install
npm run dev       # http://localhost:5173 (contact form works locally; test keys in .env)
npm run build     # outputs ./dist
npm start         # run the API server (reads .env)
npm run serve     # build, then serve site + API from one Node process
```

- Headshot: drop `public/brian.jpg` (replaces the BR monogram automatically).
- Copy lives in `index.html` and `contact/index.html`; particle formations in `src/scene.js`;
  shared behaviour in `src/core.js`; page scripts in `src/main.js` and `src/contact.js`.
- Placeholders: the LinkedIn URL, and the screenshots for any project whose image is missing.
- ⌘K / Ctrl+K (or `/`) opens the command palette.

## Portfolio

`/portfolio/` lists recent builds as plain HTML (one `<article class="proj">` each), and the home page's Work
section shows the same four as cards. To add or change a project, edit both files.

- Screenshots live in `public/work/<slug>.webp` (about 1440×900). A project with no image shows a styled placeholder automatically.
- Live sites get a "Visit site" link; set it up as an `<a>` like `brit`. Sites that no longer exist use the "Archived" status line instead (see `envisionpac`).
- Filter chips (All / Kentico / WordPress) read each article's `data-stack`.

## Contact form

`/contact/` posts JSON to `/api/contact`. The pipeline: honeypot → minimum fill time → validation →
Cloudflare Turnstile → per-IP rate limit (5/hour) → save → email via Resend.

- Fails closed: without `TURNSTILE_SECRET` every submission is refused.
- If email fails the message is still saved and the visitor still sees success.
- Only a salted hash of the visitor's IP is stored.
- Variables are listed in `.env.example`. `VITE_TURNSTILE_SITE_KEY` is baked in at **build** time.

## Staging: Netlify

Connect the GitHub repo. `netlify.toml` handles build, headers and `X-Robots-Tag: noindex`.
Set the env vars from `.env.example` in the Netlify UI. Messages go to Netlify Blobs (`contact-messages`).

## Production: our own servers

Requirements: Node 20+ for the API process, and any web server (nginx/Apache) for the static files.

1. **Build** (locally or in CI, with `VITE_TURNSTILE_SITE_KEY` set): `npm ci && npm run build`.
2. **Copy** `dist/` to the web root, and `server/` + `package.json` to `/var/www/rembytes/`. The server has no npm dependencies, so no `npm install` is needed on the box.
3. **Config**: create `/etc/rembytes.env` from `.env.example` with `TRUST_PROXY=true`, `DATA_DIR=/var/lib/rembytes`, `NOINDEX=false`, plus the Turnstile and Resend values.
4. **Run the API** with `deploy/rembytes-api.service` (systemd). It listens on 127.0.0.1:8787.
5. **Web server**: `deploy/nginx.conf.example` or `deploy/apache-vhost.conf.example` serve `dist/`, add the security/cache headers and proxy `/api/` to the API.
6. **Backups**: messages are plain JSON files in `DATA_DIR/messages/`. Back that folder up.

No reverse proxy? `STATIC_DIR=/var/www/rembytes/dist node server/index.mjs` serves the site and API together.

Before launch on rembytes.com: remove the `noindex` header (Netlify config is staging-only, so on production just leave `NOINDEX=false`).
