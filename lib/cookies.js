/**
 * Cookie helpers for auth tokens.
 * All cookies are HTTP-only, Secure, SameSite for XSS/CSRF resistance.
 *
 * Uses COOKIE_DOMAIN from env (e.g., .letsmakeai.fun) for cross-subdomain auth.
 * Falls back to exact origin if not set.
 */

function baseOptions(maxAge) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    // Use COOKIE_DOMAIN from env (e.g., .letsmakeai.fun) for cross-subdomain auth
    // Falls back to exact origin if not set
    ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
    maxAge: maxAge * 1000, // Express expects milliseconds
  };
}

/**
 * Set the access token cookie on a response.
 * 15-minute expiry.
 */
export function setAccessTokenCookie(res, token) {
  res.cookie('access_token', token, baseOptions(900));
}

/**
 * Set the refresh token cookie on a response.
 * @param {boolean} rememberMe — extends to 30 days
 */
export function setRefreshTokenCookie(res, token, rememberMe = false) {
  const maxAge = rememberMe ? 2592000 : 604800; // 30d : 7d in seconds
  res.cookie('refresh_token', token, {
    ...baseOptions(maxAge),
    sameSite: 'lax',
  });
}

/**
 * Clear both auth cookies (logout).
 */
export function clearAuthCookies(res) {
  const clearOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
    maxAge: 0,
  };
  res.cookie('access_token', '', clearOptions);
  res.cookie('refresh_token', '', clearOptions);
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
 * Simple cookie header parser.
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