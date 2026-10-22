import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

/** Serves netlify/functions/contact.mjs at /api/contact during `vite` dev, so the form works without the Netlify CLI. */
function devContactApi() {
  return {
    name: 'dev-contact-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '');
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;

      server.middlewares.use('/api/contact', async (req, res) => {
        try {
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const headers = new Headers();
          for (const h of ['content-type', 'origin', 'user-agent']) if (req.headers[h]) headers.set(h, req.headers[h]);

          const request = new Request(`http://${req.headers.host}/api/contact`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const mod = await server.ssrLoadModule('/netlify/functions/contact.mjs');
          const response = await mod.default(request, { ip: req.socket.remoteAddress });

          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          console.error(err);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: 'server_error' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [devContactApi()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        contact: resolve(import.meta.dirname, 'contact/index.html'),
      },
    },
  },
});
