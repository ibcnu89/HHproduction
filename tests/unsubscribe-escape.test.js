import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');

// ── Stored-HTML injection (unsubscribe route) ────────────────────────
// The unsubscribe route renders outreach_prospects.email into HTML.
// Stored values are attacker-controllable: they must render as inert
// text, never as markup. These tests exercise the REAL route code from
// server.js via the same section-extraction harness used by
// tests/auth.test.js.

test('unsubscribe route escapes stored prospect emails into inert text', async () => {
  const source = readFileSync(`${root}/server.js`, 'utf8');
  const start = source.indexOf("app.get('/api/outreach/unsubscribe'");
  assert.ok(start >= 0, 'unsubscribe route must exist');
  const next = source.indexOf('\napp.', start + 1);
  let section = source.slice(start, next < 0 ? undefined : next);
  section = section.slice(0, section.lastIndexOf('\n});') + 4);

  const { escapeHtml, safeHtml } = await import(`${root}/lib/html-escape.js`);

  // Fake DB client: any token returns a row whose email is the payload.
  const payloads = [
    `<script>alert(1)</script>`,
    `<img src=x onerror=alert(1)>`,
    `"><svg onload=alert(1)>`,
    `" onmouseover="alert(1)`,
    `x@y</p><script>alert(1)</script>`,
    `&#106;avascript:alert(1)`,           // entity-encoded variant
    `%3Cscript%3Ealert(1)%3C/script%3E`, // percent-encoded variant
    `'+alert(1)+'`,                       // quote-break variant
  ];
  for (const payload of payloads) {
    const pool = {
      async query(sql, params) {
        if (sql.includes('UPDATE outreach_prospects')) {
          return { rows: [{ email: payload, school: 'Test School' }] };
        }
        return { rows: [] };
      },
    };
    const routes = {};
    const app = { get(p, ...h) { routes[p] = h.at(-1); } };
    const context = {
      app,
      pool,
      safeHtml,
      escapeHtml,
      res: null,
      console: { error() {} },
      process: { env: {} },
    };
    vm.runInNewContext(section, context);
    const res = {
      statusCode: 200,
      body: null,
      headers: {},
      status(n) { this.statusCode = n; return this; },
      set(k, v) { this.headers[k] = v; return this; },
      send(b) { this.body = b; return this; },
    };
    await routes['/api/outreach/unsubscribe']({ params: {}, query: { token: '01234567-89ab-cdef-0123-456789abcdef' } }, res);
    assert.equal(res.statusCode, 200, `route must render for payload ${JSON.stringify(payload).slice(0, 30)}`);
    assert.ok(typeof res.body === 'string');
    // The payload must never survive as EXECUTABLE markup: if it contains
    // structural characters (<, >, ", ') they must not appear un-escaped.
    const escaped = escapeHtml(payload);
    assert.ok(!res.body.includes('<script'), 'no live script tag');
    assert.ok(!/<[a-z!\/]/i.test(res.body.replace(/<(\/?(html|head|title|meta|style|body|div|h1|p|a|!doctype))([\s>])/gi, '')), 'no unexpected markup from stored data');
    // The escaped form must be present (legitimate display preserved):
    assert.ok(res.body.includes(escaped), `escaped form must be displayed: ${JSON.stringify(escaped).slice(0, 40)}`);
    // No executable script tag or event handler survives:
    assert.ok(!/<script/i.test(res.body), 'no script tag may render');
    assert.ok(!/onerror\s*=/i.test(res.body), 'no event-handler markup may render');
    assert.ok(!/onload\s*=/i.test(res.body), 'no onload handler may render');
  }

  // Legitimate email display is preserved
  const pool = {
    async query() { return { rows: [{ email: 'teacher@school.edu', school: 'River Ridge' }] }; },
  };
  const routes = {};
  const app = { get(p, ...h) { routes[p] = h.at(-1); } };
  const context = { app, pool, safeHtml, escapeHtml, console: { error() {} }, process: { env: {} } };
  vm.runInNewContext(section, context);
  const res = {
    statusCode: 200, body: null, headers: {},
    status(n) { this.statusCode = n; return this; },
    set(k, v) { this.headers[k] = v; return this; },
    send(b) { this.body = b; return this; },
  };
  await routes['/api/outreach/unsubscribe']({ params: {}, query: { token: '01234567-89ab-cdef-0123-456789abcdef' } }, res);
  assert.ok(res.body.includes('teacher@school.edu'), 'legitimate email must display normally');
});

test('escapeHtml helper neutralizes all structural HTML characters', async () => {
  const { escapeHtml } = await import(`${root}/lib/html-escape.js`);
  const E = (n, tail) => String.fromCharCode(38) + tail; // build entities explicitly
  const cases = {
    '<': E(0, 'lt;'),
    '>': E(0, 'gt;'),
    '"': E(0, 'quot;'),
    "'": E(0, '#39;'),
    '&': E(0, 'amp;'),
    '`': E(0, '#96;'),
    '=': E(0, '#61;'),
  };
  for (const [raw, escaped] of Object.entries(cases)) {
    assert.equal(escapeHtml(raw), escaped, `${raw} must escape`);
  }
  const A = String.fromCharCode(38);
  assert.equal(escapeHtml('<script>alert(1)</script>'), A + 'lt;script' + A + 'gt;alert(1)' + A + 'lt;/script' + A + 'gt;');
  // Encoded variants stay inert: the decoder input is the ORIGINAL string;
  // entity/percent forms contain no raw < > " so they escape to themselves
  // prefixed where needed — the key property: no < > " ' survive un-escaped.
  const out = escapeHtml('%3Cscript%3E');
  assert.ok(!/[<>"']/.test(out.replace(/&#39;|"/g, '')), 'no structural chars in output');
});

// ── Debug webhook endpoint removal ──────────────────────────────────
test('the unauthenticated webhook debug endpoint is removed', () => {
  const source = readFileSync(`${root}/server.js`, 'utf8');
  assert.ok(!source.includes("app.post('/api/billing/webhook/debug'"), 'debug route must not exist');
  assert.ok(!source.includes('[DEBUG Webhook]'), 'no debug header/body logging may remain');
  // The REAL webhook must still exist and verify signatures:
  const i = source.indexOf("app.post('/api/billing/webhook'");
  assert.ok(i >= 0, 'real webhook route must remain');
  const section = source.slice(i, i + 1500);
  assert.ok(section.includes('STRIPE_WEBHOOK_SECRET'), 'real webhook must check its secret');
  assert.ok(section.includes('constructEvent') || section.includes('webhooks.constructEvent'), 'signature verification must be present');
});
