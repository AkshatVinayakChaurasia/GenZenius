/**
 * RiskFusion AI — Authentication.
 *
 * A dependency-free client for Supabase Auth (GoTrue) built on its documented
 * REST API, so the static frontend needs no bundler and the Content Security
 * Policy stays free of third-party script origins.
 *
 * Supported: email/password sign-in and sign-up, Google OAuth via the
 * Authorization Code flow with PKCE, silent access-token refresh, route
 * protection, and sign-out with server-side session revocation.
 *
 * Session storage: sessionStorage by default, so tokens die with the tab.
 * "Remember me" promotes the session to localStorage so it survives a restart.
 */
(function () {
  const config = window.RISKFUSION_CONFIG;
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error('RiskFusion configuration is missing. scripts/config.js must load before scripts/auth.js.');
  }

  const AUTH_URL = `${config.supabaseUrl.replace(/\/$/, '')}/auth/v1`;
  const SESSION_KEY = 'riskfusion.session';
  const VERIFIER_KEY = 'riskfusion.pkce_verifier';
  const REMEMBER_KEY = 'riskfusion.remember';
  /** Refresh this many seconds before the access token actually expires. */
  const REFRESH_SKEW_SECONDS = 60;

  /* ─────────────── storage ─────────────── */

  const remembered = () => localStorage.getItem(REMEMBER_KEY) === 'true';

  function readSession() {
    for (const store of [localStorage, sessionStorage]) {
      const raw = store.getItem(SESSION_KEY);
      if (!raw) continue;
      try {
        const session = JSON.parse(raw);
        if (session && session.access_token && session.refresh_token) return session;
      } catch {
        /* Corrupt entry — drop it rather than trapping the user on the login page. */
      }
      store.removeItem(SESSION_KEY);
    }
    return null;
  }

  function writeSession(session) {
    const target = remembered() ? localStorage : sessionStorage;
    const other = remembered() ? sessionStorage : localStorage;
    other.removeItem(SESSION_KEY);
    target.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
  }

  function normalise(payload) {
    if (!payload || !payload.access_token) throw new Error('Authentication response did not contain a session.');
    const lifetime = Number(payload.expires_in || 3600);
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      token_type: payload.token_type || 'bearer',
      expires_at: payload.expires_at ? Number(payload.expires_at) : Math.floor(Date.now() / 1000) + lifetime,
      user: payload.user || null,
    };
  }

  /* ─────────────── transport ─────────────── */

  /**
   * GoTrue reports failures as {error_description} / {msg} / {message}; surface
   * whichever is present so the user sees the real reason, never a raw status.
   */
  async function authRequest(path, { method = 'POST', body, accessToken } = {}) {
    const headers = { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' };
    headers.Authorization = `Bearer ${accessToken || config.supabaseAnonKey}`;

    let response;
    try {
      response = await fetch(`${AUTH_URL}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('Could not reach the authentication service. Check your connection and try again.');
    }

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const detail = payload && (payload.error_description || payload.msg || payload.message || payload.error);
      throw new Error(detail || `Authentication failed (${response.status}).`);
    }
    return payload;
  }

  /* ─────────────── PKCE helpers ─────────────── */

  function randomVerifier() {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return base64Url(bytes);
  }

  function base64Url(bytes) {
    let binary = '';
    new Uint8Array(bytes).forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function challengeFor(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64Url(digest);
  }

  /* ─────────────── session lifecycle ─────────────── */

  let refreshInFlight = null;

  async function refreshSession(session) {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const payload = await authRequest('/token?grant_type=refresh_token', {
          body: { refresh_token: session.refresh_token },
        });
        const next = normalise(payload);
        writeSession(next);
        return next;
      } catch (error) {
        // A rejected refresh token means the session is genuinely over.
        clearSession();
        throw error;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  /** Current session, refreshed if the access token is expired or about to be. */
  async function getSession() {
    const session = readSession();
    if (!session) return null;
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at - REFRESH_SKEW_SECONDS > now) return session;
    try {
      return await refreshSession(session);
    } catch {
      return null;
    }
  }

  async function getAccessToken() {
    const session = await getSession();
    return session ? session.access_token : null;
  }

  /** Cached user profile, without a network round trip. */
  function currentUser() {
    const session = readSession();
    return session ? session.user : null;
  }

  /** Display name for the signed-in user, falling back through the metadata Google returns. */
  function displayName() {
    const user = currentUser();
    if (!user) return '';
    const meta = user.user_metadata || {};
    return meta.full_name || meta.name || (user.email || '').split('@')[0] || 'Analyst';
  }

  function initials() {
    const name = displayName();
    const parts = name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'RF';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* ─────────────── sign in / up / out ─────────────── */

  async function signInWithPassword(email, password, remember) {
    localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
    const payload = await authRequest('/token?grant_type=password', {
      body: { email: String(email).trim(), password },
    });
    const session = normalise(payload);
    writeSession(session);
    return session;
  }

  /**
   * Creates an account. When the project requires email confirmation GoTrue
   * returns a user without a session, so the caller must tell the user to
   * confirm rather than assuming they are signed in.
   */
  async function signUpWithPassword(email, password, remember) {
    localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
    const payload = await authRequest('/signup', {
      body: {
        email: String(email).trim(),
        password,
        data: {},
        gotrue_meta_security: {},
      },
    });
    if (payload && payload.access_token) {
      const session = normalise(payload);
      writeSession(session);
      return { session, confirmationRequired: false };
    }
    return { session: null, confirmationRequired: true };
  }

  /** Starts the Google Authorization Code + PKCE flow by redirecting to Google. */
  async function signInWithGoogle(remember) {
    localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false');
    const verifier = randomVerifier();
    const challenge = await challengeFor(verifier);
    // Kept in sessionStorage: it must survive the redirect but never outlive the tab.
    sessionStorage.setItem(VERIFIER_KEY, verifier);

    const params = new URLSearchParams({
      provider: 'google',
      redirect_to: new URL('callback.html', location.href).toString(),
      code_challenge: challenge,
      code_challenge_method: 's256',
    });
    location.assign(`${AUTH_URL}/authorize?${params.toString()}`);
  }

  /** Completes the OAuth flow on callback.html by exchanging the code for a session. */
  async function exchangeCodeForSession(code) {
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!verifier) throw new Error('This sign-in link has expired. Please start again from the sign-in page.');
    const payload = await authRequest('/token?grant_type=pkce', {
      body: { auth_code: code, code_verifier: verifier },
    });
    sessionStorage.removeItem(VERIFIER_KEY);
    const session = normalise(payload);
    writeSession(session);
    return session;
  }

  async function sendPasswordReset(email) {
    await authRequest('/recover', {
      body: { email: String(email).trim(), gotrue_meta_security: {} },
    });
  }

  /**
   * Ends the session. Local state is cleared first and unconditionally, so a
   * slow or failing auth service can never leave the browser signed in;
   * server-side revocation is then attempted under a short timeout.
   */
  async function signOut() {
    const session = readSession();
    clearSession();
    if (!session) return;
    try {
      await Promise.race([
        authRequest('/logout', { accessToken: session.access_token, body: {} }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
      ]);
    } catch {
      /* The local session is already gone; the token expires on its own. */
    }
  }

  /** Which third-party providers the project actually has configured. */
  let settingsPromise = null;
  function providerEnabled(provider) {
    if (!settingsPromise) {
      settingsPromise = authRequest('/settings', { method: 'GET' }).catch(() => null);
    }
    return settingsPromise.then((settings) => Boolean(settings && settings.external && settings.external[provider]));
  }

  /* ─────────────── route protection ─────────────── */

  /** Set once a page has declared itself protected, so public pages are left alone. */
  let guarded = false;
  let redirecting = false;

  /**
   * Sends the visitor to sign in, remembering where they were headed.
   *
   * Several things can discover a dead session at once — the route guard and
   * any in-flight API call — so the first caller wins and later ones are
   * ignored. Otherwise a second redirect would drop the `next` destination.
   */
  function redirectToLogin() {
    if (redirecting) return;
    redirecting = true;
    const target = location.pathname.split('/').pop() + location.search;
    const next = target && target !== config.loginPage ? `?next=${encodeURIComponent(target)}` : '';
    location.replace(config.loginPage + next);
  }

  /**
   * Guards an application page. Redirects to the login page when there is no
   * valid session, remembering where the user was headed.
   */
  async function requireSession() {
    guarded = true;
    const session = await getSession();
    if (session) {
      scheduleRefresh(session);
      return session;
    }
    redirectToLogin();
    return null;
  }

  /** Keeps the access token fresh for as long as the page stays open. */
  let refreshTimer = null;
  function scheduleRefresh(session) {
    if (refreshTimer) clearTimeout(refreshTimer);
    const delay = Math.max(15, session.expires_at - Math.floor(Date.now() / 1000) - REFRESH_SKEW_SECONDS) * 1000;
    refreshTimer = setTimeout(async () => {
      const next = await getSession();
      if (next) scheduleRefresh(next);
      else redirectToLogin();
    }, delay);
  }

  /**
   * Sends a workspace tab back to the login page when another tab signs out.
   * Public pages (landing, sign-in) never call requireSession, so they stay put.
   */
  window.addEventListener('storage', (event) => {
    if (event.key !== SESSION_KEY || event.newValue) return;
    if (guarded && !readSession()) redirectToLogin();
  });

  window.RiskFusionAuth = {
    getSession,
    getAccessToken,
    currentUser,
    displayName,
    initials,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    exchangeCodeForSession,
    sendPasswordReset,
    signOut,
    providerEnabled,
    requireSession,
    redirectToLogin,
  };
})();
