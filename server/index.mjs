#!/usr/bin/env node
/* ──────────────────────────────────────────────────────────────
   Standalone server for rembytes.com. No framework, no dependencies,
   no hosting-provider lock-in. Needs Node 20+.

     POST /api/contact   the contact form (server/contact-core.mjs)
     GET  /api/health    liveness probe
     GET  /*             static site from STATIC_DIR (optional)

   Typical production setup: nginx/Apache serve ./dist and proxy /api/ here.
   Without a reverse proxy, set STATIC_DIR=./dist and this serves everything.

   Configuration comes from environment variables (see .env.example):
     PORT=8787  HOST=127.0.0.1  DATA_DIR=./data  STATIC_DIR=  TRUST_PROXY=false  NOINDEX=false
   ────────────────────────────────────────────────────────────── */

import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { handleContact } from './contact-core.mjs';
import { createFileStore, pruneRateLimits } from './stores.mjs';

const env = (key) => process.env[key];
const PORT = Number(env('PORT') || 8787);
const HOST = env('HOST') || '127.0.0.1';
const DATA_DIR = path.resolve(env('DATA_DIR') || './data');
const STATIC_DIR = env('STATIC_DIR') ? path.resolve(env('STATIC_DIR')) : null;
// Only enable behind a reverse proxy you control, one that overwrites X-Real-IP / X-Forwarded-Host.
const TRUST_PROXY = env('TRUST_PROXY') === 'true';
const NOINDEX = env('NOINDEX') === 'true';
const MAX_BODY = 32 * 1024;

const messages = createFileStore(path.join(DATA_DIR, 'messages'));
const limitsDir = path.join(DATA_DIR, 'rate-limits');
const limits = createFileStore(limitsDir);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json', '.map': 'application/json',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  ...(NOINDEX ? { 'x-robots-tag': 'noindex, nofollow' } : {}),
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

const sendJson = (res, status, obj) =>
  send(res, status, JSON.stringify(obj), { 'content-type': 'application/json', 'cache-control': 'no-store' });

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const real = req.headers['x-real-ip'];
    if (real) return String(real).trim();
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

async function handleApiContact(req, res) {
  const host = (TRUST_PROXY && req.headers['x-forwarded-host']) || req.headers.host || `localhost:${PORT}`;
  const proto = (TRUST_PROXY && req.headers['x-forwarded-proto']) || 'http';

  const headers = new Headers();
  for (const h of ['content-type', 'origin', 'user-agent']) if (req.headers[h]) headers.set(h, String(req.headers[h]));

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? await readBody(req) : undefined;
  const request = new Request(`${proto}://${host}/api/contact`, { method: req.method, headers, body });

  const response = await handleContact(request, { ip: clientIp(req), env, messages, limits });
  const out = {};
  response.headers.forEach((v, k) => { out[k] = v; });
  send(res, response.status, Buffer.from(await response.arrayBuffer()), out);
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD' });

  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad Request'); }
  if (rel.includes('\0')) return send(res, 400, 'Bad Request');

  let file = path.join(STATIC_DIR, path.normalize(rel));
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + path.sep)) return send(res, 403, 'Forbidden');

  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    if (!rel.endsWith('/')) return send(res, 301, '', { location: `${pathname}/` });
    file = path.join(file, 'index.html');
    info = await stat(file).catch(() => null);
  }
  if (!info?.isFile()) {
    const nf = path.join(STATIC_DIR, '404.html');
    const has404 = await stat(nf).then((s) => s.isFile()).catch(() => false);
    return send(res, 404, has404 ? await readFile(nf) : 'Not Found',
      { 'content-type': has404 ? MIME['.html'] : 'text/plain; charset=utf-8' });
  }

  const ext = path.extname(file).toLowerCase();
  const cache = pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': info.size,
    'cache-control': cache,
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (pathname === '/api/health') return sendJson(res, 200, { ok: true });
    if (pathname === '/api/contact') return await handleApiContact(req, res);
    if (pathname.startsWith('/api/')) return sendJson(res, 404, { ok: false, error: 'not_found' });
    if (STATIC_DIR) return await serveStatic(req, res, pathname);
    return send(res, 404, 'Not Found', { 'content-type': 'text/plain; charset=utf-8' });
  } catch (err) {
    if (err.status === 413) { res.shouldKeepAlive = false; return sendJson(res, 413, { ok: false, error: 'too_large' }); }
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'server_error' });
    else res.destroy();
  }
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, HOST, () => {
  console.log(`rembytes server listening on http://${HOST}:${PORT}`);
  console.log(`  data:    ${DATA_DIR}`);
  console.log(`  static:  ${STATIC_DIR ?? '(not served; use nginx/Apache for the site)'}`);
  console.log(`  proxy:   ${TRUST_PROXY ? 'trusting X-Real-IP / X-Forwarded-*' : 'not trusting proxy headers'}`);
  if (!env('TURNSTILE_SECRET')) console.warn('  WARNING: TURNSTILE_SECRET is not set. The contact form will refuse every submission.');
  if (!env('RESEND_API_KEY')) console.warn('  WARNING: RESEND_API_KEY is not set. Messages will be saved but not emailed.');
});

const prune = setInterval(() => pruneRateLimits(limitsDir).catch(() => {}), 60 * 60 * 1000);
prune.unref();

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { console.log(`${sig} received, shutting down`); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 5000).unref(); });
}
