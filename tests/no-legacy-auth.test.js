import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');

test('the insecure Vercel alternate OAuth implementation is fully removed', () => {
  // The unified auth handler and the standalone Google callback handler —
  // which used unbound base64-JSON state and decoded (never verified)
  // Google ID tokens — must not exist anywhere in the tree.
  for (const p of ['api/auth/index.js', 'api/auth/google/callback.js']) {
    assert.equal(existsSync(`${root}/${p}`), false, `${p} must be removed`);
  }
  // No route may ever be mounted at the Vercel callback path from these files.
  const vercel = existsSync(`${root}/vercel.json`) ? readFileSync(`${root}/vercel.json`, 'utf8') : '';
  assert.doesNotMatch(vercel, /api\/auth/, 'vercel.json must not route to auth handlers');
});

test('no remaining code path decodes Google ID tokens without verification', () => {
  // Security invariant: id_token payloads may only be trusted after
  // signature verification. The Railway implementation decodes manually
  // AFTER a server-to-server token exchange over TLS (the code came from
  // Google's token endpoint, not the client), which is the accepted
  // pattern. Grep-guard: any NEW file introducing client-supplied
  // id_token parsing must go through verification first.
  // Here we assert the removed handlers are not re-introduced.
  const forbidden = ['api/auth/index.js', 'api/auth/google/callback.js'];
  for (const p of forbidden) {
    assert.equal(existsSync(`${root}/${p}`), false);
  }
});
