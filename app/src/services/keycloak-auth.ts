import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { AuthUser } from "@/data/types";

/**
 * Keycloak Direct Access Grant (Resource Owner Password Credentials) service.
 *
 * No OIDC library is used: the mature RN/OIDC libraries deliberately omit the
 * password grant (it is deprecated in OAuth 2.1), so we talk to Keycloak's
 * token endpoint directly with `fetch` and persist tokens in expo-secure-store.
 *
 * The app uses the public `stigvidd-app` client, so no client secret is sent.
 */

const OIDC_URL = process.env.EXPO_PUBLIC_OIDC_URL ?? "";
const REALM = process.env.EXPO_PUBLIC_OIDC_REALM ?? "";
const CLIENT_ID = process.env.EXPO_PUBLIC_CLIENT_ID ?? "";

const REALM_BASE = `${OIDC_URL}/realms/${REALM}/protocol/openid-connect`;
const TOKEN_ENDPOINT = `${REALM_BASE}/token`;
const LOGOUT_ENDPOINT = `${REALM_BASE}/logout`;

const SCOPE = "openid profile email";

// Refresh slightly before the token actually expires to avoid races.
const EXPIRY_SKEW_SECONDS = 30;

const STORAGE_KEYS = {
  accessToken: "kc_access_token",
  refreshToken: "kc_refresh_token",
  accessExpiresAt: "kc_access_expires_at",
} as const;

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  id_token?: string;
  scope?: string;
}

/** Thrown when Keycloak rejects credentials (HTTP 401, error=invalid_grant). */
export class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid_grant");
    this.name = "InvalidCredentialsError";
  }
}

// In-memory cache so the hot path (every API call) avoids hitting SecureStore.
let accessToken: string | null = null;
let refreshToken: string | null = null;
let accessExpiresAt = 0; // epoch ms
let refreshPromise: Promise<string | null> | null = null;

// Called when a refresh fails and the session is gone, so the auth layer can
// flip back to the signed-out state. Registered once by useInitAuth.
let onSessionExpired: (() => void) | null = null;

/** Register (or clear, with null) the callback fired when a refresh fails mid-session. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function persistTokens(tokens: KeycloakTokenResponse): Promise<void> {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  accessExpiresAt = (nowSeconds() + tokens.expires_in) * 1000;

  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEYS.accessToken, tokens.access_token),
    SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, tokens.refresh_token),
    SecureStore.setItemAsync(STORAGE_KEYS.accessExpiresAt, String(accessExpiresAt)),
  ]);
}

/** Loads tokens from secure storage into memory. Call once on app start. */
export async function loadTokens(): Promise<{ refreshToken: string | null }> {
  const [storedAccess, storedRefresh, storedExpiry] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.accessToken),
    SecureStore.getItemAsync(STORAGE_KEYS.refreshToken),
    SecureStore.getItemAsync(STORAGE_KEYS.accessExpiresAt),
  ]);

  accessToken = storedAccess;
  refreshToken = storedRefresh;
  accessExpiresAt = storedExpiry ? Number(storedExpiry) : 0;

  return { refreshToken };
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  accessExpiresAt = 0;

  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken),
    SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
    SecureStore.deleteItemAsync(STORAGE_KEYS.accessExpiresAt),
  ]);
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

  await persistTokens(tokens);
  return decodeUser(tokens.id_token ?? tokens.access_token);
}

/** Exchange the refresh token for a fresh access token. Returns the user, or null if refresh fails. */
export async function refreshGrant(token: string): Promise<AuthUser | null> {
  try {
    const tokens = await requestToken({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: token,
    });
    await persistTokens(tokens);
    return decodeUser(tokens.id_token ?? tokens.access_token);
  } catch {
    await clearTokens();
    onSessionExpired?.();
    return null;
  }
}

/** Revoke the session at Keycloak and clear stored tokens. */
export async function logoutKeycloak(): Promise<void> {
  const token = refreshToken;
  if (token) {
    try {
      await fetch(LOGOUT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: CLIENT_ID, refresh_token: token }).toString(),
      });
    } catch {
      // Best-effort revocation; we clear local tokens regardless.
    }
  }
  await clearTokens();
}

/**
 * Returns a valid access token, refreshing transparently when expired.
 * This is the single choke point the API layer calls via getUserToken().
 * Concurrent callers share one in-flight refresh.
 */
export async function getValidAccessToken(): Promise<string | null> {
  if (!accessToken && !refreshToken) {
    return null;
  }

  const stillValid = accessToken && nowSeconds() < accessExpiresAt / 1000 - EXPIRY_SKEW_SECONDS;
  if (stillValid) {
    return accessToken;
  }

  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    const token = refreshToken;
    refreshPromise = refreshGrant(token)
      .then(() => accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}
