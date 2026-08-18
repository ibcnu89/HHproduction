/**
 * Server-side UTM attribution.
 * Reads the `hh_utm` cookie (set by the frontend from ?utm_* params via
 * getCookie, which already decodeURIComponents) and returns sanitized
 * { utm_source, utm_medium, utm_campaign } for persistence on the users row
 * at creation time (email register or Google OAuth).
 * Never throws — on any parse/cookie issue just returns an empty object.
 */
import { getCookie } from './cookies.js';

/** Pull safe scalar fields out of untrusted cookie JSON. */
function clean(parsed) {
  if (!parsed || typeof parsed !== 'object') return {};
  const s = parsed.source, m = parsed.medium, c = parsed.campaign;
  const out = {};
  if (typeof s === 'string' && s.trim()) out.utm_source = s.trim().slice(0, 100);
  if (typeof m === 'string' && m.trim()) out.utm_medium = m.trim().slice(0, 50);
  if (typeof c === 'string' && c.trim()) out.utm_campaign = c.trim().slice(0, 100);
  return out;
}

export function readUtmFromRequest(req) {
  const raw = getCookie(req, 'hh_utm');
  if (!raw) return {};
  try {
    return clean(JSON.parse(raw));
  } catch {
    return {};
  }
}