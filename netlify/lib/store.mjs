import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Tiny key/value store with one interface and two backends:
 *  - Netlify Blobs when running on Netlify (production, staging, `netlify dev`)
 *  - a JSON file in ./.data when running under plain `vite` (local development only)
 */
export async function openStore(name) {
  if (globalThis.Netlify) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore({ name, consistency: 'strong' });
    return {
      kind: 'netlify-blobs',
      set: (key, value) => store.setJSON(key, value),
      get: (key) => store.get(key, { type: 'json' }),
      remove: (key) => store.delete(key),
    };
  }

  const file = path.join(process.cwd(), '.data', `${name}.json`);
  const read = async () => {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return {}; }
  };
  const write = async (data) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2));
  };
  return {
    kind: 'local-file',
    async set(key, value) { const d = await read(); d[key] = value; await write(d); },
    async get(key) { return (await read())[key] ?? null; },
    async remove(key) { const d = await read(); delete d[key]; await write(d); },
  };
}
