/**
 * Cookie helpers for auth tokens.
 * All cookies are HTTP-only, Secure, SameSite for XSS/CSRF resistance.
 *
 * IMPORTANT: We do NOT set a Domain attribute on cookies.
 * Omitting Domain binds cookies to the exact origin that set them,
 * which avoids public-suffix rejection issues (e.g., .up.railway.app).
 * Cookies set by hhproduction-production.up.railway.app are only sent
 * back to that exact host — no subdomain sharing needed for this app.
 *
 * Express compatibility note:
 * Express's res.cookie() sets one cookie per call and auto-appends to Set-Cookie.
 */

function baseOptions(maxAge) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    // NO domain — bind to exact origin
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