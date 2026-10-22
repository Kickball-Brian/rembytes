# rembytes.com

Vite + GSAP + Three.js + Lenis. Static pages plus one Netlify Function for the contact form.

```
npm install
npm run dev       # http://localhost:5173  (contact form works locally too)
npm run build     # outputs ./dist
```

- Headshot: drop `public/brian.jpg` (replaces the BR monogram automatically).
- Copy lives in `index.html` and `contact/index.html`; particle formations in `src/scene.js`;
  shared behaviour in `src/core.js`; page scripts in `src/main.js` and `src/contact.js`.
- Placeholder content: the four "Case study" cards in the Work section, the LinkedIn URL.
- Press ⌘K / Ctrl+K (or `/`) for the command palette.

## Contact form

`/contact/` posts JSON to `/api/contact` (`netlify/functions/contact.mjs`). The function runs, in order:
honeypot → minimum-fill-time check → validation → Cloudflare Turnstile → per-IP rate limit (5/hour)
→ save to Netlify Blobs → email via Resend.

- Messages are stored in the Netlify Blobs store `contact-messages` (Netlify UI → Blobs, or `netlify blobs:list contact-messages`).
- Locally (`npm run dev`) messages go to `.data/` (gitignored) and Cloudflare's test keys in `.env` always pass.
- If email fails, the message is still saved and the visitor still sees success.

### Environment variables (Netlify → Site configuration → Environment variables)

See `.env.example`. Required in production: `VITE_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`,
`RESEND_API_KEY`, `CONTACT_FROM`. `VITE_*` values are baked in at build time, so redeploy after changing them.

## Staging

`netlify.toml` sends `X-Robots-Tag: noindex` on every response. Delete that line before launching on rembytes.com.
