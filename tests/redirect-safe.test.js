import test from 'node:test';
import assert from 'node:assert/strict';

const { safeAppRedirect, appRedirectOr } = await import('../lib/redirect-safe.js');

test('safeAppRedirect accepts legitimate application-relative paths', () => {
  for (const good of [
    '/',
    '/apps/homeworkhelper',
    '/classroom',
    '/settings',
    '/',
    '/grading/results?assignment=1',
    '/apps/homeworkhelper?session=abc123',
    '/terms',
  ]) {
    assert.equal(safeAppRedirect(good), good, `should accept: ${good.slice(0, 40)}`);
  }
});

test('safeAppRedirect rejects quote-breaking script payloads', () => {
  // Classic string-literal escape in inline JS — must never pass validation.
  for (const evil of [
    `';window.alert(1);//`,
    `';window.location='https://attacker.example';//`,
    "\\'-alert(1)-'",
    `'-alert(1)-'`,
    `";fetch('//evil.example',{method:'POST'})//`,
  ]) {
    assert.equal(safeAppRedirect(evil), null, 'quote-break payload must be rejected');
  }
});

test('safeAppRedirect rejects HTML/script-tag-breaking payloads', () => {
  for (const evil of [
    `</script><script>alert(1)</script>`,
    `/<script>alert(1)</script>`,
    `/foo"><img src=x onerror=alert(1)>`,
    `/%3Cscript%3Ealert(1)%3C/script%3E`,
    `/&#x3C;script&#x3E;`,
  ]) {
    assert.equal(safeAppRedirect(evil), null, 'script-tag payload must be rejected');
  }
});

test('safeAppRedirect rejects javascript: and data: scheme URLs', () => {
  for (const evil of [
    'javascript:alert(1)',
    '/javascript:alert(1)',
    '/javascript%3Aalert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'JAVASCRIPT:alert(1)',
    '/JaVaScRiPt:alert(1)',
  ]) {
    assert.equal(safeAppRedirect(evil), null, 'dangerous scheme must be rejected');
  }
});

test('safeAppRedirect rejects external origins and protocol-relative URLs', () => {
  for (const evil of [
    'https://attacker.example/',
    'http://attacker.example/phish',
    '//attacker.example/',
    '/\\attacker.example',
    '\\\\attacker.example',
    'https://letsmakeai.fun.attacker.example/',
    '/https://attacker.example/',
    '/\\/attacker.example',
  ]) {
    assert.equal(safeAppRedirect(evil), null, 'external origin must be rejected');
  }
});

test('safeAppRedirect rejects encoded and double-encoded bypass attempts', () => {
  for (const evil of [
    '/%2F%2Fattacker.example',
    '/%2f%2fattacker.example',
    '/%252F%252Fattacker.example',
    '/%2e%2e%2f',
    '/..%2f..%2fetc',
    `/%27;alert(1);//`,
    `/%27%3Balert(1)%3B%2F%2F`,
    '/%09javascript:alert(1)',
    '/%00/',
  ]) {
    assert.equal(safeAppRedirect(evil), null, 'encoded bypass must be rejected');
  }
});

test('safeAppRedirect rejects malformed, control-char, and whitespace values', () => {
  for (const evil of [
    '',
    'plainstring',
    ' /apps',
    '/apps ',
    '/apps\t',
    '/apps\n',
    '/ap\x00ps',
    '/ap\x1fps',
    '/apps\x7f',
    '\x0d\x0aLocation: https://evil.example',
    '/apps\r\nX-Injected: 1',
    123,
    null,
    undefined,
    { toString: () => '/apps' },
    ['array-impl'],
    { length: 3, 0: 'x' },
  ]) {
    assert.equal(safeAppRedirect(evil), null, 'malformed value must be rejected');
  }
});

test('safeAppRedirect rejects traversal and auth-loop destinations', () => {
  for (const evil of [
    '/../admin',
    '/foo/../..',
    '/auth',
    '/login',
    '/signin',
    '/AUTH',
    '/auth/',
    '/login?next=/admin',
  ]) {
    assert.equal(safeAppRedirect(evil), null, 'loop/traversal must be rejected: ' + evil);
  }
  // Overlong input is rejected regardless of content.
  assert.equal(safeAppRedirect('/' + 'a'.repeat(600)), null, 'overlong must be rejected');
});

test('appRedirectOr degrades safely and never returns null', () => {
  assert.equal(appRedirectOr(`';alert(1);//`), '/apps/homeworkhelper');
  assert.equal(appRedirectOr('/classroom'), '/classroom');
  assert.equal(appRedirectOr(undefined), '/apps/homeworkhelper');
  assert.equal(appRedirectOr('https://evil.example'), '/apps/homeworkhelper');
  assert.ok(appRedirectOr(null).startsWith('/'));
});

test('validated redirects can never compose into an executable JS string', () => {
  // Property check: whatever passes validation, when embedded in the kinds
  // of contexts attackers target (script string literal, HTML attribute,
  // Location header), must not break out. Validators pass => charset is
  // [A-Za-z0-9._~!$&*+,;=:@/()?,-] with no control chars, so no quote,
  // angle bracket, backslash, square bracket, or % can appear.
  const passing = ['/apps/homeworkhelper', '/', '/grading?x=1&y=2', '/a(b)c'];
  for (const p of passing) {
    const v = safeAppRedirect(p);
    assert.ok(v !== null);
    // No metacharacters capable of escaping a JS string literal or HTML.
    assert.doesNotMatch(v, /['"`<>\\]/);
    assert.doesNotMatch(v, /[\x00-\x1f\x7f]/);
    assert.ok(!v.includes('%'), 'no percent-encoding in accepted output');
    assert.ok(v.startsWith('/') && !v.startsWith('//'), 'same-origin relative only');
  }
});

// ── Canonical-domain (www → apex) middleware tests ──────────────────
// The middleware lives inside server.js; the logic is exercised via a
// faithful extraction, mirroring the route-harness technique used by
// tests/auth.test.js: same source-of-truth code, no duplicates to drift.

test('www→apex middleware redirects www to the canonical apex origin', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const vm = await import('node:vm');
  const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
  const source = readFileSync(`${root}/server.js`, 'utf8');
  const marker = '// ── Canonical-domain redirect: www → apex ──';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, 'middleware must exist in server.js');
  const end = source.indexOf('// ── Capture raw body', start);
  assert.ok(end > start);
  const section = source.slice(start, end);
  const redirects = [];
  const context = {
    res: {
      redirect(code, url) { redirects.push({ code, url }); return 'redirected'; },
    },
    URL,
    process: { env: { GOOGLE_REDIRECT_URI: 'https://letsmakeai.fun/api/auth/google/callback' } },
  };
  vm.runInNewContext(section + `
    globalThis.__mw = app.use;`, { ...context, app: { use(fn) { globalThis.__mwFn = fn; } } });
  const mw = globalThis.__mwFn;

  // www host → 301 to apex, path + query preserved (req.url now)
  redirects.length = 0;
  let nextCalled = false;
  let out = mw({ headers: { host: 'www.letsmakeai.fun' }, url: '/apps/homeworkhelper?x=1', originalUrl: '/apps/homeworkhelper?x=1' }, context.res, () => { nextCalled = true; });
  assert.equal(out, 'redirected');
  assert.equal(redirects[0].code, 301);
  assert.equal(redirects[0].url, 'https://letsmakeai.fun/apps/homeworkhelper?x=1');
  assert.equal(nextCalled, false);

  // SECURITY (audit finding): "//evil.example/path" must stay on apex —
  // the path may never resolve as a URL. It is dropped to the canonical home.
  redirects.length = 0; nextCalled = false;
  out = mw({ headers: { host: 'www.letsmakeai.fun' }, url: '//evil.example/path', originalUrl: '//evil.example/path' }, context.res, () => { nextCalled = true; });
  assert.equal(out, 'redirected');
  assert.equal(redirects[0].url, 'https://letsmakeai.fun/', 'protocol-relative path must collapse to apex home, never an external host');
  assert.ok(!redirects[0].url.includes('evil.example'), 'no external host in destination');

  // Backslash variant "/\evil.example" must also stay on apex
  redirects.length = 0; nextCalled = false;
  mw({ headers: { host: 'www.letsmakeai.fun' }, url: '/\\evil.example/path', originalUrl: '/\\evil.example/path' }, context.res, () => { nextCalled = true; });
  assert.equal(redirects[0].url, 'https://letsmakeai.fun/', 'backslash host-smuggling must collapse to apex home');

  // Scheme-looking path "/https://evil.example" must stay on apex
  redirects.length = 0; nextCalled = false;
  mw({ headers: { host: 'www.letsmakeai.fun' }, url: '/https://evil.example', originalUrl: '/https://evil.example' }, context.res, () => { nextCalled = true; });
  assert.equal(redirects[0].url, 'https://letsmakeai.fun/', 'scheme-prefixed path must collapse to apex home');

  // Encoded-slash variant: Express decodes %2F%2F before the route sees it;
  // if it survives as literal "//" it must be dropped. Raw "%2F%2Fevil"
  // in req.url: contains no control chars and no scheme, but starts with %
  // — the middleware passes it through as an opaque path segment on the
  // APEX origin, never as a URL. Verify it stays on-origin either way.
  redirects.length = 0; nextCalled = false;
  mw({ headers: { host: 'www.letsmakeai.fun' }, url: '//%2F%2Fevil.example', originalUrl: '//%2F%2Fevil.example' }, context.res, () => { nextCalled = true; });
  assert.ok(redirects[0]?.url.startsWith('https://letsmakeai.fun'), 'encoded variants must stay on apex');
  assert.ok(!redirects[0]?.url.includes('evil.example'), 'encoded host must never appear in destination');

  // Control characters in the path: redirect to apex home (never forwarded)
  redirects.length = 0; nextCalled = false;
  mw({ headers: { host: 'www.letsmakeai.fun' }, url: '/ok\tpath', originalUrl: '/ok\tpath' }, context.res, () => { nextCalled = true; });
  assert.ok(redirects[0]?.url.startsWith('https://letsmakeai.fun'), 'control-char path stays on apex');
  assert.ok(!redirects[0]?.url.includes('\t'), 'control characters must not be forwarded');

  // Malformed empty path → home
  redirects.length = 0; nextCalled = false;
  mw({ headers: { host: 'www.letsmakeai.fun' }, url: '', originalUrl: '' }, context.res, () => { nextCalled = true; });
  assert.equal(redirects[0].url, 'https://letsmakeai.fun/');

  // apex host → passes through
  redirects.length = 0; nextCalled = false;
  mw({ headers: { host: 'letsmakeai.fun' }, url: '/', originalUrl: '/' }, context.res, () => { nextCalled = true; });
  assert.equal(redirects.length, 0);
  assert.equal(nextCalled, true);

  // Host-header cannot pick the destination: attacker-supplied host on
  // another domain is NOT redirected at all (only exact www.<apex> matches)
  redirects.length = 0; nextCalled = false;
  mw({ headers: { host: 'evil.example' }, url: '/', originalUrl: '/' }, context.res, () => { nextCalled = true; });
  assert.equal(redirects.length, 0, 'foreign hosts must pass through untouched');
  assert.equal(nextCalled, true);

  // attacker-supplied www.evil.example must NOT redirect to anything
  redirects.length = 0; nextCalled = false;
  mw({ headers: { host: 'www.evil.example' }, url: '/', originalUrl: '/' }, context.res, () => { nextCalled = true; });
  assert.equal(redirects.length, 0, 'www.<other-domain> must not redirect');
  assert.equal(nextCalled, true);

  // no Host header at all → pass through
  redirects.length = 0; nextCalled = false;
  mw({ headers: {}, url: '/', originalUrl: '/' }, context.res, () => { nextCalled = true; });
  assert.equal(redirects.length, 0);
  assert.equal(nextCalled, true);
});
