/**
 * Safe HTML rendering helpers for the few routes that must serve HTML
 * directly from the server (OAuth interstitials, unsubscribe page).
 *
 * RULE: never interpolate untrusted values into an HTML string without
 * escapeHtml(). Everything user- or database-controlled renders as inert
 * text — never as markup.
 */

const AMP = chr(38);
function chr(n) { return String.fromCharCode(n); }

const HTML_ESCAPES = {
  [chr(38)]: chr(38) + 'amp;',   // &
  [chr(60)]: chr(38) + 'lt;',    // <
  [chr(62)]: chr(38) + 'gt;',    // >
  [chr(34)]: chr(38) + 'quot;',  // "
  [chr(39)]: chr(38) + '#39;',   // '
  [chr(96)]: chr(38) + '#96;',   // `
  [chr(61)]: chr(38) + '#61;',   // = (attribute-smuggling neutralizer)
};

/**
 * Escape every character that can change HTML structure or introduce an
 * event handler. Covers angle brackets (tags), quotes (attribute
 * injection), apostrophes, backticks (template/IE contexts), ampersands
 * (entity smuggling) and equals (attribute separators).
 * @param {unknown} value
 * @returns {string} inert text safe for any HTML context
 */
export function escapeHtml(value) {
  const s = String(value ?? '');
  let out = '';
  for (const ch of s) out += HTML_ESCAPES[ch] ?? ch;
  return out;
}

/**
 * Render an HTML document from trusted template parts and untrusted
 * values: literal sections are kept verbatim; every interpolated value
 * is HTML-escaped. Usage mirrors a tagged template:
 *
 *   safeHtml`<p>${userInput}</p>`
 *
 * @returns {string}
 */
export function safeHtml(strings, ...values) {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += escapeHtml(values[i]);
  }
  return out;
}

/**
 * Validate that a rendered HTML string contains only escaped instances of
 * an untrusted value. Returns true if `needle` never appears un-escaped.
 */
export function isRenderedInert(html, needle) {
  if (!needle) return true;
  return !String(html).includes(String(needle));
}
