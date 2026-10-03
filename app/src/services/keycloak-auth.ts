// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import * as SecureStore from "expo-secure-store";
import { jwtDecode } from "jwt-decode";
import { AuthUser } from "@/data/types";
import { logger } from "./logger";
import { withTimeout } from "./with-timeout";

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

// `offline_access` requests an OFFLINE refresh token. Without it Keycloak issues
// an online refresh token bound to the SSO session, which dies on the realm's SSO
// Session Idle (default 30 min) / Session Max (default 10 h) timeouts — i.e. the
// user gets silently logged out. The offline token's lifetime is governed instead
// by the realm's Offline Session settings, letting the session persist long-term.
const SCOPE = "openid profile email offline_access";

// Refresh slightly before the token actually expires to avoid races.
const EXPIRY_SKEW_SECONDS = 30;

// RN's Android fetch (OkHttp) has no timeout; see docs/notes/android-fetch-no-timeout-stale-token-401.md. keep-comment: hidden platform constraint
export const TOKEN_REQUEST_TIMEOUT_MS = 15_000;
const TIMEOUT_MESSAGE = "Keycloak request timed out";
const HTTP_FAILURE_MESSAGE = "Keycloak token request failed: HTTP";

const UNAUTHORIZED_COOLDOWN_MS = 30_000;

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

/**
 * Thrown when Keycloak rejects the grant because the account is disabled — which is what a
 * registered but not yet email-verified account looks like from here. Keycloak answers 400
 * with the same `invalid_grant` error as a wrong password and only distinguishes the two in
 * `error_description`.
 *
 * It EXTENDS InvalidCredentialsError deliberately: refreshGrant() ends the session on
 * `instanceof InvalidCredentialsError`, and a mid-session account disable should end the
 * session exactly like a dead refresh token. Only the login screen needs the narrower type,
 * and it has to test for this one FIRST — see
 * docs/notes/verification-gate-lives-in-keycloak-not-the-api.md.
 */
export class AccountNotVerifiedError extends InvalidCredentialsError {
  constructor() {
    super();
    this.name = "AccountNotVerifiedError";
  }
}

export class SessionUnavailableError extends Error {
  constructor() {
    super("session-unavailable");
    this.name = "SessionUnavailableError";
  }
}

type RefreshOutcome = "refreshed" | "expired" | "unavailable";

export type UnauthorizedOutcome = RefreshOutcome | "rejected";

export type PasswordGrantPurpose = "login" | "delete-account";

type GrantFailure = {
  outcome: "invalid_credentials" | "account_not_verified" | "timeout" | "network" | "server_error" | "unexpected";
  errorMessage?: string;
  errorName?: string;
};

// In-memory cache so the hot path (every API call) avoids hitting SecureStore.
let accessToken: string | null = null;
let refreshToken: string | null = null;
let accessExpiresAt = 0; // epoch ms
let refreshPromise: Promise<RefreshOutcome> | null = null;
let lastForcedRefreshAt = 0; // epoch ms
let reportedCooldownFor = 0; // epoch ms
// One line per distinct failure: offline, every API call retries the refresh. keep-comment: protects the log buffer
let lastRefreshFailure: string | null = null;

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

/**
 * Whether a rejected grant was rejected because the account is disabled. Keycloak says so only
 * in `error_description`, so the body has to be read — and an unreadable or unexpected body
 * must fall back to the ordinary "bad credentials" answer rather than throw over it.
 */
async function isAccountDisabled(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as { error_description?: string };
    return body.error_description?.toLowerCase().includes("disabled") ?? false;
  } catch {
    return false;
  }
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
  lastRefreshFailure = null;

  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken),
    SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
    SecureStore.deleteItemAsync(STORAGE_KEYS.accessExpiresAt),
  ]);
}

async function requestToken(body: Record<string, string>): Promise<KeycloakTokenResponse> {
  return withTimeout(
    async (signal) => {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
        signal,
      });

      if (response.status === 400 || response.status === 401) {
        throw (await isAccountDisabled(response)) ? new AccountNotVerifiedError() : new InvalidCredentialsError();
      }

      if (!response.ok) {
        throw new Error(`${HTTP_FAILURE_MESSAGE} ${response.status}`);
      }

      return (await response.json()) as KeycloakTokenResponse;
    },
    TOKEN_REQUEST_TIMEOUT_MS,
    TIMEOUT_MESSAGE,
  );
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

// Says what went wrong and never who: no email, username or password may reach the context. keep-comment: GDPR invariant
function describeGrantFailure(error: unknown): GrantFailure {
  // AccountNotVerifiedError extends InvalidCredentialsError, so it must be tested first. keep-comment: class-order trap
  if (error instanceof AccountNotVerifiedError) return { outcome: "account_not_verified" };
  if (error instanceof InvalidCredentialsError) return { outcome: "invalid_credentials" };
  if (!(error instanceof Error)) return { outcome: "unexpected", errorName: typeof error };
  if (error.message === TIMEOUT_MESSAGE || error.name === "AbortError") return { outcome: "timeout" };
  // React Native's fetch rejects with a TypeError when no response arrives. keep-comment: hidden platform behaviour
  if (error instanceof TypeError) return { outcome: "network", errorMessage: error.message };
  if (error.message.startsWith(HTTP_FAILURE_MESSAGE)) return { outcome: "server_error", errorMessage: error.message };
  // A JSON.parse or jwt-decode message can quote the token response, which carries the email. keep-comment: GDPR reason only the name is logged
  return { outcome: "unexpected", errorName: error.name };
}

/** Direct Access Grant login. Returns the authenticated user, or throws InvalidCredentialsError. */
export async function passwordGrant(
  email: string,
  password: string,
  purpose: PasswordGrantPurpose = "login",
): Promise<AuthUser> {
  try {
    const tokens = await requestToken({
      grant_type: "password",
      client_id: CLIENT_ID,
      username: email,
      password,
      scope: SCOPE,
    });

    await persistTokens(tokens);
    return decodeUser(tokens.id_token ?? tokens.access_token);
  } catch (error) {
    const failure = describeGrantFailure(error);
    if (purpose === "login") logger.warn("Login failed", failure);
    else logger.info("Delete-account password check failed", failure);
    throw error;
  }
}

/**
 * Only a genuine rejection of the refresh token (Keycloak `invalid_grant`, surfaced
 * as InvalidCredentialsError) ends the session and signals the auth layer. Transient
 * failures — network errors, timeouts, 5xx — must NOT clear the stored tokens: a
 * momentary blip would otherwise permanently log the user out. Those are left intact
 * so a later call can retry.
 */
async function refresh(token: string): Promise<RefreshOutcome> {
  try {
    const tokens = await requestToken({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: token,
    });
    await persistTokens(tokens);
    lastRefreshFailure = null;
    return "refreshed";
  } catch (error) {
    const expired = error instanceof InvalidCredentialsError;
    const outcome = expired ? "expired" : "unavailable";
    const reason = expired ? error.name : String(error);
    // Nothing else records a failed refresh: API calls throw before their own logging runs. keep-comment: hidden observability gap
    if (lastRefreshFailure !== `${outcome}|${reason}`) {
      lastRefreshFailure = `${outcome}|${reason}`;
      logger.warn("Token refresh failed", { outcome, reason });
    }
    if (expired) {
      await clearTokens();
      onSessionExpired?.();
      return "expired";
    }
    return "unavailable";
  }
}

export async function refreshGrant(token: string): Promise<AuthUser | null> {
  const outcome = await refresh(token);
  return outcome === "refreshed" && accessToken ? decodeUser(accessToken) : null;
}

function refreshOnce(): Promise<RefreshOutcome> {
  const token = refreshToken;
  if (!token) {
    return Promise.resolve("expired");
  }
  if (!refreshPromise) {
    refreshPromise = refresh(token).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Revoke the session at Keycloak and clear stored tokens. */
export async function logoutKeycloak(): Promise<void> {
  const token = refreshToken;
  if (token) {
    try {
      const response = await withTimeout(
        (signal) =>
          fetch(LOGOUT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: CLIENT_ID, refresh_token: token }).toString(),
            signal,
          }),
        TOKEN_REQUEST_TIMEOUT_MS,
        TIMEOUT_MESSAGE,
      );
      if (!response.ok) {
        logger.info("Logout revoke failed", { errorMessage: `Keycloak logout failed: HTTP ${response.status}` });
      }
    } catch (error) {
      // Best-effort revocation; we clear local tokens regardless.
      logger.info("Logout revoke failed", { errorMessage: String(error) });
    }
  }
  await clearTokens();
}

/**
 * Restore the signed-in user on app start. Loads persisted tokens, then obtains a
 * valid access token through the SAME single-flight path the API layer uses, so the
 * startup refresh and any concurrent first API calls share ONE refresh request. This
 * matters under Keycloak refresh-token rotation: two concurrent uses of the same
 * refresh token would make one fail with `invalid_grant` and log the user out.
 * Returns the decoded user, or null if no session could be restored.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  await loadTokens();
  try {
    const token = await getValidAccessToken();
    return token ? decodeUser(token) : null;
  } catch (error) {
    // Offline: keep the stored identity, but never send that token. keep-comment: signing out on a cold start without signal strands a hike
    if (error instanceof SessionUnavailableError && accessToken) {
      return decodeUser(accessToken);
    }
    throw error;
  }
}

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

  const outcome = await refreshOnce();
  if (outcome === "expired") {
    return null;
  }
  if (outcome === "unavailable" || !accessToken) {
    throw new SessionUnavailableError();
  }
  return accessToken;
}

export async function handleUnauthorized(): Promise<UnauthorizedOutcome> {
  // The API refused a token refreshed moments ago; refreshing again would loop. keep-comment: loop guard
  if (Date.now() - lastForcedRefreshAt < UNAUTHORIZED_COOLDOWN_MS) {
    // Every 401 lands here during the cooldown, so log the window once. keep-comment: protects the log buffer
    if (reportedCooldownFor !== lastForcedRefreshAt) {
      reportedCooldownFor = lastForcedRefreshAt;
      logger.warn("Session recovery rejected", { reason: "cooldown" });
    }
    return "rejected";
  }
  const outcome = await refreshOnce();
  if (outcome === "refreshed") {
    lastForcedRefreshAt = Date.now();
  }
  return outcome;
}

export function resetUnauthorizedCooldown(): void {
  lastForcedRefreshAt = 0;
  reportedCooldownFor = 0;
}
