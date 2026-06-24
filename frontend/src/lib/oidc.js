// Browser-side OpenID Connect Authorization Code + PKCE flow against Keycloak,
// used by the staff/admin portal for true SSO (no in-app password form).
// Uses the public `suprloopz-web` client — no client secret in the browser.
const KC_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'suprloopz';
const CLIENT_ID = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'suprloopz-web';

const authBase = `${KC_URL}/realms/${REALM}/protocol/openid-connect`;
// Staff portal OIDC callback lives under the /admin path prefix.
const redirectUri = () => `${window.location.origin}/admin/auth/callback`;

function base64url(bytes) {
  let bin = '';
  new Uint8Array(bytes).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLen = 48) {
  const a = new Uint8Array(byteLen);
  crypto.getRandomValues(a);
  return base64url(a);
}

async function sha256(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return base64url(digest);
}

/** Verify the Keycloak realm is actually reachable before redirecting, so a
 *  down/absent auth server shows a friendly message instead of a foreign 404. */
async function assertKeycloakReachable() {
  const discovery = `${authBase.replace('/protocol/openid-connect', '')}/.well-known/openid-configuration`;
  try {
    const res = await fetch(discovery, { cache: 'no-store' });
    if (!res.ok) throw new Error('bad status');
    await res.json();
  } catch {
    throw new Error(
      `The authentication server is not reachable at ${KC_URL}. Make sure Keycloak is running, then try again.`,
    );
  }
}

/** Kick off SSO: store PKCE verifier + state, then redirect to Keycloak. */
export async function startSsoLogin() {
  await assertKeycloakReachable();
  const verifier = randomString(48);
  const challenge = await sha256(verifier);
  const state = randomString(24);
  sessionStorage.setItem('oidc.verifier', verifier);
  sessionStorage.setItem('oidc.state', state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid',
    redirect_uri: redirectUri(),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.assign(`${authBase}/auth?${params.toString()}`);
}

/** Complete SSO on the callback page: validate state, exchange code → tokens. */
export async function completeSsoLogin({ code, state }) {
  const expectedState = sessionStorage.getItem('oidc.state');
  const verifier = sessionStorage.getItem('oidc.verifier');
  if (!verifier || !state || state !== expectedState) {
    throw new Error('SSO state validation failed. Please try signing in again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch(`${authBase}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error('Could not complete sign-in (token exchange failed).');

  const json = await res.json();
  sessionStorage.removeItem('oidc.verifier');
  sessionStorage.removeItem('oidc.state');
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}
