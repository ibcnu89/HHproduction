/**
 * Cookie helpers for auth tokens.
 * All cookies are HTTP-only, Secure, SameSite for XSS/CSRF resistance.
 */

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

/**
 * Default cookie options applied to both access and refresh tokens.
 */
function baseOptions(maxAge) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge, // seconds
  };
}

/**
 * Set the access token cookie on a response.
 * Note: maxAge=0 for session cookies works, but we use explicit 15-min expiry.
 */
export function setAccessTokenCookie(res, token) {
  res.setHeader('Set-Cookie', serializeCookie('access_token', token, baseOptions(900))); // 15 min
}

/**
 * Set the refresh token cookie on a response.
 * @param {boolean} rememberMe — extends to 30 days
 */
export function setRefreshTokenCookie(res, token, rememberMe = false) {
  const maxAge = rememberMe ? 2592000 : 604800; // 30d : 7d
  // SameSite=Lax for refresh token — allows it to be set on cross-site redirects
  // (Google OAuth callback) while still blocking cross-site subresource requests.
  res.setHeader(
    'Set-Cookie',
    serializeCookie('refresh_token', token, {
      ...baseOptions(maxAge),
      sameSite: 'lax',
    })
  );
}

/**
 * Clear both auth cookies (logout).
 */
export function clearAuthCookies(res) {
  const clearOptions = {
    ...baseOptions(0), // maxAge=0 = delete now
    expires: new Date(0),
  };

  // Set-Cookie header can take multiple cookies as an array
  res.setHeader('Set-Cookie', [
    serializeCookie('access_token', '', clearOptions),
    serializeCookie('refresh_token', '', clearOptions),
  ]);
}

/**
 * Read a cookie value from the request.
 * Parses raw Cookie header string.
 */
export function getCookie(req, name) {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;

  const cookies = parseCookieHeader(cookieHeader);
  return cookies[name] || null;
}

/**
 * Simple cookie header parser — avoids pulling in the full 'cookie' package.
 * Handles the common case; the npm 'cookie' package is installed for edge cases.
 */
function parseCookieHeader(header) {
  const result = {};
  header.split(';').forEach((pair) => {
    const eq = pair.indexOf('=');
    if (eq === -1) return;
    const key = pair.substring(0, eq).trim();
    const val = pair.substring(eq + 1).trim();
    result[key] = decodeURIComponent(val);
  });
  return result;
}

/**
 * Serialize a cookie key=value with options.
 * Minimal implementation — the npm 'cookie' package handles edge cases.
 */
function serializeCookie(name, value, options = {}) {
  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

  if (options.maxAge !== undefined) {
    cookie += `; Max-Age=${options.maxAge}`;
  }
  if (options.expires) {
    cookie += `; Expires=${options.expires.toUTCString()}`;
  }
  if (options.domain) {
    cookie += `; Domain=${options.domain}`;
  }
  if (options.path) {
    cookie += `; Path=${options.path}`;
  }
  if (options.secure) {
    cookie += '; Secure';
  }
  if (options.httpOnly) {
    cookie += '; HttpOnly';
  }
  if (options.sameSite) {
    cookie += `; SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`;
  }

  return cookie;
}