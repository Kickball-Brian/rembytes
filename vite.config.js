import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

/** Serves the contact API at /api/contact during `vite` dev, using the same core as production. */
function devContactApi() {
  return {
    name: 'dev-contact-api',
    configureServer(server) {
      const loaded = loadEnv(server.config.mode, process.cwd(), '');
      const env = (key) => process.env[key] ?? loaded[key];

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

          const { handleContact } = await server.ssrLoadModule('/server/contact-core.mjs');
          const { createFileStore } = await server.ssrLoadModule('/server/stores.mjs');
          const response = await handleContact(request, {
            ip: req.socket.remoteAddress,
            env,
            messages: createFileStore(resolve(process.cwd(), '.data/messages')),
            limits: createFileStore(resolve(process.cwd(), '.data/rate-limits')),
          });

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
        portfolio: resolve(import.meta.dirname, 'portfolio/index.html'),
      },
    },
  },
});
