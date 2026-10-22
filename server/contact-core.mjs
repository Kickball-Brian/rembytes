/* ──────────────────────────────────────────────────────────────
   Contact form handler. Host-agnostic: it only uses web-standard
   Request/Response, plus whatever the caller injects:

     handleContact(request, { ip, env, messages, limits })

     ip        visitor IP string (the adapter decides how to find it)
     env(key)  reads a config value
     messages  store for submissions   { get, set, remove }
     limits    store for rate limiting { get, set, remove }

   Pipeline: honeypot → min-fill-time → validation → Turnstile
             → rate limit → save → email (Resend)
   Adapters: server/index.mjs (Node), netlify/functions/contact.mjs, vite.config.js (dev)
   ────────────────────────────────────────────────────────────── */

export const TOPICS = ['Marketing strategy', 'Technical SEO', 'Marketing automation', 'Web development', 'Something else'];
const MIN_FILL_MS = 2500;          // humans can't write a message faster than this
const MAX_BODY_BYTES = 20_000;
const RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };  // 5 messages / hour / IP

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

const oneLine = (v, max) =>
  String(v ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const multiLine = (v, max) =>
  String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function validate(p) {
  const errors = {};
  const data = {
    name: oneLine(p.name, 100),
    email: oneLine(p.email, 254),
    company: oneLine(p.company, 100),
    topics: Array.isArray(p.topics) ? [...new Set(p.topics.map((t) => oneLine(t, 40)).filter((t) => TOPICS.includes(t)))] : [],
    message: multiLine(p.message, 5000),
  };
  if (data.name.length < 1) errors.name = 'Please tell me your name.';
  if (!EMAIL_RE.test(data.email)) errors.email = 'That email address doesn’t look right.';
  if (data.message.length < 10) errors.message = 'Give me a little more detail (10 characters or more).';
  return { data, errors };
}

/** Fails closed: with no secret configured, every submission is refused (503), never waved through. */
async function verifyTurnstile(token, ip, env) {
  const secret = env('TURNSTILE_SECRET');
  if (!secret) return { ok: false, misconfigured: true };
  if (!token) return { ok: false };
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, ...(ip && ip !== 'unknown' ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const out = await res.json();
    return { ok: out.success === true };
  } catch (err) {
    console.error('turnstile verify failed', err);
    return { ok: false };
  }
}

async function rateLimited(limits, ipHash) {
  const key = `rl-${ipHash}`;
  const now = Date.now();
  const rec = await limits.get(key);
  if (rec && rec.resetAt > now) {
    if (rec.count >= RATE_LIMIT.max) return true;
    await limits.set(key, { count: rec.count + 1, resetAt: rec.resetAt });
  } else {
    await limits.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
  }
  return false;
}

async function sendEmail(msg, env) {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) { console.warn('RESEND_API_KEY not set: message stored but no email sent'); return false; }

  const to = env('CONTACT_TO') || 'brian@rembytes.com';
  const from = env('CONTACT_FROM') || 'rembytes.com <contact@rembytes.com>';
  const topics = msg.topics.length ? msg.topics.join(', ') : 'Not specified';

  const text = [
    `New message from ${msg.name} <${msg.email}>`,
    msg.company ? `Company: ${msg.company}` : null,
    `Interested in: ${topics}`,
    '',
    msg.message,
    '',
    `Sent ${msg.createdAt} via rembytes.com`,
  ].filter((l) => l !== null).join('\n');

  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;line-height:1.5;color:#111">
    <h2 style="margin:0 0 4px">${escapeHtml(msg.name)}</h2>
    <p style="margin:0 0 16px;color:#555"><a href="mailto:${escapeHtml(msg.email)}">${escapeHtml(msg.email)}</a>${msg.company ? ` · ${escapeHtml(msg.company)}` : ''}</p>
    <p style="margin:0 0 16px"><strong>Interested in:</strong> ${escapeHtml(topics)}</p>
    <div style="white-space:pre-wrap;padding:16px;background:#f5f5f2;border-radius:8px">${escapeHtml(msg.message)}</div>
    <p style="margin-top:16px;color:#888;font-size:12px">Sent ${escapeHtml(msg.createdAt)} via rembytes.com. Reply to this email to answer directly.</p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: msg.email, subject: `New message from ${msg.name}`, text, html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return true;
}

export async function handleContact(req, { ip = 'unknown', env, messages, limits }) {
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });

  // same-origin only (req.url carries the public host the adapter resolved)
  const origin = req.headers.get('origin');
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === new URL(req.url).host; } catch { /* malformed */ }
    if (!ok) return json({ ok: false, error: 'forbidden' }, 403);
  }
  if (!(req.headers.get('content-type') || '').includes('application/json')) {
    return json({ ok: false, error: 'unsupported_media_type' }, 415);
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: 'too_large' }, 413);
  let payload;
  try { payload = JSON.parse(raw); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
  if (!payload || typeof payload !== 'object') return json({ ok: false, error: 'bad_json' }, 400);

  // bots: honeypot filled, or form "submitted" implausibly fast → pretend it worked
  if (oneLine(payload.website, 200) !== '' || !(Number(payload.t) >= MIN_FILL_MS)) {
    return json({ ok: true });
  }

  const { data, errors } = validate(payload);
  if (Object.keys(errors).length) return json({ ok: false, error: 'validation', errors }, 422);

  const captcha = await verifyTurnstile(typeof payload.token === 'string' ? payload.token : '', ip, env);
  if (captcha.misconfigured) {
    console.error('TURNSTILE_SECRET is not set: refusing all submissions');
    return json({ ok: false, error: 'not_configured' }, 503);
  }
  if (!captcha.ok) return json({ ok: false, error: 'captcha' }, 400);

  const ipHash = (await sha256(`${env('IP_HASH_SALT') || 'rembytes'}:${ip}`)).slice(0, 24);
  if (await rateLimited(limits, ipHash)) {
    return json({ ok: false, error: 'rate_limited' }, 429, { 'retry-after': '3600' });
  }

  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const record = {
    id,
    createdAt,
    ...data,
    ipHash,
    userAgent: oneLine(req.headers.get('user-agent'), 200),
    emailed: false,
  };

  const key = `${createdAt}_${id}`;
  await messages.set(key, record);

  try {
    record.emailed = await sendEmail(record, env);
    if (record.emailed) await messages.set(key, record);
  } catch (err) {
    // The message is safely stored; don't make the visitor retry because email hiccuped.
    console.error('email notification failed', err);
  }

  return json({ ok: true });
}
