import { jwtDecode } from "jwt-decode";
import type { AuthUser } from "@/types/types";

/**
 * Keycloak Direct Access Grant (Resource Owner Password Credentials) for the
 * browser admin SPA. Talks to Keycloak's token endpoint directly with `fetch`
 * using the public `stigvidd-admin` client (no client secret).
 *
 * Token storage: the access token + expiry live in memory; the refresh token is
 * persisted to localStorage so the session survives a page reload. This is
 * acceptable for an internal admin tool. `restoreSession()` reads the refresh
 * token on startup and exchanges it for a fresh access token.
 */

const OIDC_URL = import.meta.env.VITE_OIDC_URL ?? "";
const REALM = import.meta.env.VITE_OIDC_REALM ?? "";
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID ?? "";

const REALM_BASE = `${OIDC_URL}/realms/${REALM}/protocol/openid-connect`;
const TOKEN_ENDPOINT = `${REALM_BASE}/token`;
const LOGOUT_ENDPOINT = `${REALM_BASE}/logout`;

// `offline_access` yields an offline refresh token whose lifetime is governed by
// the realm's Offline Session settings, so the admin isn't logged out by the SSO
// idle timeout. Mirrors the mobile app.
const SCOPE = "openid profile email offline_access";

const EXPIRY_SKEW_SECONDS = 30;
const REFRESH_TOKEN_KEY = "kc_refresh_token";

// Only Keycloak users holding this realm role may access the admin.
const REQUIRED_ROLE = "stigvidd-admin";

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  id_token?: string;
  scope?: string;
}

/** Thrown when Keycloak rejects credentials / a refresh token (HTTP 400/401, invalid_grant). */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid_grant");
    this.name = "InvalidCredentialsError";
  }
}

/** Thrown when the authenticated user lacks the required `stigvidd-admin` realm role. */
export class NotAuthorizedError extends Error {
  constructor() {
    super("not_authorized");
    this.name = "NotAuthorizedError";
  }
}

// In-memory cache so the hot path (every API call) avoids re-reading storage.
let accessToken: string | null = null;
let accessExpiresAt = 0; // epoch ms
let refreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

// Fired when a refresh fails and the session is gone, so the auth layer can flip
// back to signed-out. Registered by the AuthProvider.
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function persistTokens(tokens: KeycloakTokenResponse): void {
  accessToken = tokens.access_token;
  accessExpiresAt = (nowSeconds() + tokens.expires_in) * 1000;
  refreshToken = tokens.refresh_token;
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  accessToken = null;
  accessExpiresAt = 0;
  refreshToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function requestToken(body: Record<string, string>): Promise<KeycloakTokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });

  if (response.status === 400 || response.status === 401) {
    throw new InvalidCredentialsError();
  }

  if (!response.ok) {
    throw new Error(`Keycloak token request failed: HTTP ${response.status}`);
  }

  return (await response.json()) as KeycloakTokenResponse;
}

/** True when the access token carries the required realm role. Realm roles live in the access token. */
function hasRequiredRole(accessToken: string): boolean {
  const { realm_access } = jwtDecode<{ realm_access?: { roles?: string[] } }>(accessToken);
  return realm_access?.roles?.includes(REQUIRED_ROLE) ?? false;
}

/** Decode the identity claims from a Keycloak token into the app's AuthUser shape. */
export function decodeUser(token: string): AuthUser {
  const claims = jwtDecode<{
    sub: string;
    email?: string;
    preferred_username?: string;
    name?: string;
  }>(token);

  return {
    id: claims.sub,
    email: claims.email ?? "",
    username: claims.preferred_username ?? claims.name ?? "",
  };
}

/** Direct Access Grant login. Returns the authenticated user, or throws InvalidCredentialsError. */
export async function passwordGrant(email: string, password: string): Promise<AuthUser> {
  const tokens = await requestToken({
    grant_type: "password",
    client_id: CLIENT_ID,
    username: email,
    password,
    scope: SCOPE,
  });

  // Reject non-admins before storing any tokens, so no session is established.
  if (!hasRequiredRole(tokens.access_token)) {
    throw new NotAuthorizedError();
  }

  persistTokens(tokens);
  return decodeUser(tokens.id_token ?? tokens.access_token);
}

/**
 * Exchange the refresh token for a fresh access token. Returns the user, or null.
 * Only a genuine rejection (invalid_grant) ends the session and clears tokens;
 * transient failures (network, 5xx) leave the stored token intact for a later retry.
 */
export async function refreshGrant(token: string): Promise<AuthUser | null> {
  try {
    const tokens = await requestToken({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: token,
    });
    // Re-check on every refresh so a revoked role (or a pre-existing non-admin
    // session) ends the session instead of silently continuing.
    if (!hasRequiredRole(tokens.access_token)) {
      clearTokens();
      onSessionExpired?.();
      return null;
    }
    persistTokens(tokens);
    return decodeUser(tokens.id_token ?? tokens.access_token);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      clearTokens();
      onSessionExpired?.();
    }
    return null;
  }
}

/** Revoke the session at Keycloak and clear stored tokens. */
export async function logoutKeycloak(): Promise<void> {
  const token = refreshToken ?? localStorage.getItem(REFRESH_TOKEN_KEY);
  if (token) {
    try {
      await fetch(LOGOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: CLIENT_ID, refresh_token: token }).toString(),
      });
    } catch {
      // Best-effort revocation; clear local tokens regardless.
    }
  }
  clearTokens();
}

/**
 * Restore the signed-in user on app start: read the persisted refresh token and
 * exchange it for a fresh access token. Returns null when there's no session.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!stored) return null;
  refreshToken = stored;
  return refreshGrant(stored);
}

/**
 * Returns a valid access token, refreshing transparently when expired.
 * The single choke point the API layer uses. Concurrent callers share one refresh.
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (accessToken && nowSeconds() < accessExpiresAt / 1000 - EXPIRY_SKEW_SECONDS) {
    return accessToken;
  }

  const token = refreshToken ?? localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!token) return null;

  if (!refreshPromise) {
    refreshPromise = refreshGrant(token)
      .then(() => accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}
