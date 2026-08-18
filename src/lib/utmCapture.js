/**
 * UTM attribution capture.
 * On every app load, if marketing UTM params are present in the URL
 * (?utm_source=facebook&utm_campaign=fb-week1&utm_medium=social),
 * persist them in a short-lived cookie `hh_utm` (JSON).
 *
 * The server reads this cookie at user-creation time (email register AND
 * Google OAuth) and stores source/medium/campaign on the users row, so we can
 * see which channel actually drives trial signups.
 *
 * Non-marketing visitors get NO cookie -> naturally attributed as 'direct'.
 */
const UTM_COOKIE = 'hh_utm';

function setCookie(name, value, days) {
  if (typeof document === 'undefined') return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()};SameSite=Lax`;
}

/** Read UTM params from a URL, return {source, medium, campaign} with only the set keys. */
export function extractUtm(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const s = parsed.searchParams.get('utm_source');
  const m = parsed.searchParams.get('utm_medium');
  const c = parsed.searchParams.get('utm_campaign');
  if (!s && !m && !c) return null; // no marketing params
  const utm = {};
  if (s) utm.source = s.slice(0, 100);
  if (m) utm.medium = m.slice(0, 50);
  if (c) utm.campaign = c.slice(0, 100);
  return utm;
}

/**
 * Call once at app bootstrap. Captures UTM from the current URL into the
 * hh_utm cookie if present. Harmless no-op otherwise. Days=30 so a returning
 * visitor who converts later is still attributed (re-attribution on each visit).
 */
export function captureUtmOnce() {
  if (typeof window === 'undefined') return;
  const utm = extractUtm(window.location.href);
  if (utm) setCookie(UTM_COOKIE, JSON.stringify(utm), 30);
}