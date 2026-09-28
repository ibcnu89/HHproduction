/**
 * Strict redirect-target validation for post-auth redirects.
 *
 * Threat model: the "redirect" hint originates from client input at OAuth
 * initiation (query param or JSON body), is persisted server-side in the
 * OAuth state store, and is replayed at callback time. Anything reflected
 * into a response must therefore be constrained to same-origin application
 * paths — never executable JavaScript, never another origin.
 *
 * Allowlist model (default-deny): a value is safe only if it is a
 * plain ASCII application-relative path beginning with a single "/",
 * containing no control characters, no percent-encoding tricks, no
 * backslashes, no whitespace, no HTML/JS metacharacters, and no "//" or
 * "/\" sequences that could smuggle protocol-relative or absolute URLs.
 */

const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
// Anything outside unreserved + a few common sub-delims used in real paths
// (including ? and = for internal query strings).
const SAFE_PATH_CHARS = /^[A-Za-z0-9._~!$&*+,;=:@/'()[?\]-]+$/;

/**
 * Scheme-bearing and absolute-URL sequences that must never appear anywhere
 * in an application-relative path. Catches "/javascript:", "/https://host",
 * "/data:text/html", "/\\/evil" and their slash-prefixed smuggling variants.
 */
const EMBEDDED_URL_PATTERNS = [
  /\/[a-z][a-z0-9+.-]*:/i,   // "/scheme:" — absolute URL smuggled after a slash
  /\/\//,                    // "//host" protocol-relative anywhere in the string
  /\/\\/,                    // "/\host" backslash-normalized protocol-relative
  /\\\\/,                    // "\\host"
  /^\s/,                     // leading whitespace (browsers may strip it)
  /\s/,                      // any interior whitespace
];

/**
 * Validate a user-supplied post-auth redirect target.
 * Returns the validated path, or null when the value must be rejected.
 *
 * @param {unknown} value - candidate redirect (any type)
 * @param {string} [fallback='/'] - used when the candidate is absent/invalid
 * @returns {string|null} validated application-relative path, or null on rejection
 */
export function safeAppRedirect(value, fallback = '/') {
  if (typeof value !== 'string') return null;
  let candidate = value;

  // Length guard before any parsing work.
  if (candidate.length === 0 || candidate.length > 512) return null;

  // Trim is NOT applied: leading whitespace in a redirect target is itself
  // suspicious; browsers would still honor it. Reject instead.
  if (candidate.trim() !== candidate) return null;

  // Must start with exactly one forward slash — kills absolute URLs
  // (https://..., javascript:..., data:...) and protocol-relative (//host).
  if (!candidate.startsWith('/')) return null;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return null;

  // No percent-encoding: legitimate internal paths never need it here, and
  // encoded payloads (%2F%2F, %2e%2e, %09, double-encoding) are a classic
  // validation bypass. Reject any '%' outright.
  if (candidate.includes('%')) return null;

  // No control characters (header/JS context injection, CRLF).
  if (CONTROL_CHARS.test(candidate)) return null;

  // Backslash: browsers normalize "\" to "/" — a smuggling vector for
  // protocol-relative URLs. Already excluded by charset check below, but
  // kept explicit for clarity.
  if (candidate.includes('\\')) return null;

  // Charset allowlist — excludes quotes, angle brackets, ampersands are
  // allowed for query strings; anything exotic is rejected.
  if (!SAFE_PATH_CHARS.test(candidate)) return null;

  // Embedded absolute-URL/scheme smuggling: "/https://host", "/javascript:",
  // "/data:...", "//host" mid-string, "/\host". A legitimate app-relative
  // path never contains a scheme-look sequence after a slash.
  for (const pattern of EMBEDDED_URL_PATTERNS) {
    if (pattern.test(candidate)) return null;
  }

  // No ".." traversal fragments (covers "../", "..\\", "....//").
  if (candidate.includes('..')) return null;

  // Reject redirect targets that would bounce straight back into an auth
  // entry point (login loop). The app root "/" is allowed — it is the hub
  // landing page, not an auth route. Checked on the path component only,
  // so "/login?next=..." is caught by its pathname.
  const pathOnly = candidate.split(/[?#]/, 1)[0];
  const normalized = pathOnly.replace(/\/+$/, '') || '/';
  const loopPaths = new Set(['/auth', '/login', '/signin']);
  if (loopPaths.has(normalized.toLowerCase())) return null;

  return candidate;
}

/**
 * Convenience wrapper: validate with a guaranteed-safe fallback.
 * Never returns null — invalid input always degrades to `fallback`.
 */
export function appRedirectOr(value, fallback = '/apps/homeworkhelper') {
  return safeAppRedirect(value) ?? fallback;
}
