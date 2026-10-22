/* Netlify adapter (staging). All logic lives in server/contact-core.mjs;
   this file only wires Netlify's runtime (env, IP, Blobs storage) into it. */
import { getStore } from '@netlify/blobs';
import { handleContact } from '../../server/contact-core.mjs';

export const config = { path: '/api/contact' };

const blobs = (name) => {
  const store = getStore({ name, consistency: 'strong' });
  return {
    get: (key) => store.get(key, { type: 'json' }),
    set: (key, value) => store.setJSON(key, value),
    remove: (key) => store.delete(key),
  };
};

export default (req, context) =>
  handleContact(req, {
    ip: context.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown',
    env: (key) => Netlify.env.get(key),
    messages: blobs('contact-messages'),
    limits: blobs('rate-limits'),
  });
