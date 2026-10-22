import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Key/value store backed by one JSON file per key: `<dir>/<key>.json`.
 * Plain files on purpose: easy to inspect (`ls`, `cat`, `jq`), back up and grep.
 * Writes are atomic (temp file + rename), so a crash never leaves a half-written record.
 *
 * Interface shared with every other store: { get(key), set(key, value), remove(key) }
 */
export function createFileStore(dir) {
  const fileFor = (key) => path.join(dir, `${String(key).replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
  let ready;
  const ensureDir = () => (ready ??= fs.mkdir(dir, { recursive: true, mode: 0o750 }));

  return {
    async get(key) {
      try { return JSON.parse(await fs.readFile(fileFor(key), 'utf8')); }
      catch (err) { if (err.code === 'ENOENT') return null; throw err; }
    },
    async set(key, value) {
      await ensureDir();
      const file = fileFor(key);
      const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o640 });
      await fs.rename(tmp, file);
    },
    async remove(key) {
      try { await fs.unlink(fileFor(key)); } catch (err) { if (err.code !== 'ENOENT') throw err; }
    },
  };
}

/** Deletes expired rate-limit records so the folder doesn't grow forever. */
export async function pruneRateLimits(dir, now = Date.now()) {
  let names;
  try { names = await fs.readdir(dir); } catch { return 0; }
  let removed = 0;
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    try {
      const rec = JSON.parse(await fs.readFile(path.join(dir, n), 'utf8'));
      if (!rec.resetAt || rec.resetAt < now) { await fs.unlink(path.join(dir, n)); removed++; }
    } catch { /* ignore unreadable files */ }
  }
  return removed;
}
