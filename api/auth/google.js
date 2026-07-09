/**
 * GET /api/auth/google
 * Redirect the user to Google's OAuth 2.0 consent screen.
 * 
 * Query params (optional):
 *   redirect — where to send the user after auth completes (default: /)
 * 
 * Google will callback to /api/auth/google/callback with ?code=...
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = 'https://hhproduction.vercel.app/api/auth/google/callback';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google OAuth is not configured' });
  }

  // Preserve any post-login redirect the frontend requested
  const appRedirect = req.query.redirect || '/';

  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    // Pass the app redirect through Google's state parameter
    state: Buffer.from(JSON.stringify({ redirect: appRedirect })).toString('base64'),
  });

  const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  // Redirect the browser to Google
  return res.redirect(302, googleUrl);
}