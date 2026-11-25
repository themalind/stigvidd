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
import { isFetchFailure } from "./fetch-failure";
import { withTimeout } from "./with-timeout";

// keep-comment: no OIDC library, since they omit the password grant (deprecated in OAuth 2.1)
// keep-comment: the public stigvidd-app client, so no secret is sent

const OIDC_URL = process.env.EXPO_PUBLIC_OIDC_URL ?? "";
const REALM = process.env.EXPO_PUBLIC_OIDC_REALM ?? "";
const CLIENT_ID = process.env.EXPO_PUBLIC_CLIENT_ID ?? "";

const ISSUER = `${OIDC_URL}/realms/${REALM}`;
const REALM_BASE = `${ISSUER}/protocol/openid-connect`;
const TOKEN_ENDPOINT = `${REALM_BASE}/token`;
const LOGOUT_ENDPOINT = `${REALM_BASE}/logout`;

// keep-comment: offline_access, or the refresh token dies with the SSO session (30 min idle) and logs the user out
const SCOPE = "openid profile email offline_access";

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

export class InvalidCredentialsError extends Error {
  constructor() {
    super("invalid_grant");
    this.name = "InvalidCredentialsError";
  }
}

// keep-comment: an unverified account is disabled; Keycloak tells it from a wrong password only in error_description
// keep-comment: extends InvalidCredentialsError so a mid-session disable ends the session; the login screen
// keep-comment: must check this one first (docs/notes/verification-gate-lives-in-keycloak-not-the-api.md)
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

// keep-comment: in memory, so every API call skips SecureStore
let accessToken: string | null = null;
let refreshToken: string | null = null;
let accessExpiresAt = 0; // epoch ms
let refreshPromise: Promise<RefreshOutcome> | null = null;
let lastForcedRefreshAt = 0; // epoch ms
let reportedCooldownFor = 0; // epoch ms
// One line per distinct failure: offline, every API call retries the refresh. keep-comment: protects the log buffer
let lastRefreshFailure: string | null = null;

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// keep-comment: an unreadable body falls back to "bad credentials" rather than throwing
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

function issuerOf(token: string | null): string | null {
  if (!token) return null;
  try {
    return jwtDecode<{ iss?: string }>(token).iss ?? null;
  } catch {
    return null;
  }
}

// keep-comment: discards tokens issued by another realm
export async function loadTokens(): Promise<{ refreshToken: string | null }> {
  const [storedAccess, storedRefresh, storedExpiry] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.accessToken),
    SecureStore.getItemAsync(STORAGE_KEYS.refreshToken),
    SecureStore.getItemAsync(STORAGE_KEYS.accessExpiresAt),
  ]);

  // Every build shares one bundle id, so the keychain can hold another build's tokens. keep-comment: hidden platform behaviour
  const foreignIssuer = [storedAccess, storedRefresh].map(issuerOf).find((iss) => iss !== null && iss !== ISSUER);
  if (foreignIssuer) {
    logger.info("Discarded tokens from another realm", { issuer: foreignIssuer });
    await clearTokens();
    return { refreshToken: null };
  }

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
  if (isFetchFailure(error)) return { outcome: "network", errorMessage: error.message };
  if (error.message.startsWith(HTTP_FAILURE_MESSAGE)) return { outcome: "server_error", errorMessage: error.message };
  // A JSON.parse or jwt-decode message can quote the token response, which carries the email. keep-comment: GDPR reason only the name is logged
  return { outcome: "unexpected", errorName: error.name };
}

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

// keep-comment: only invalid_grant ends the session; a network blip, timeout or 5xx keeps the tokens
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
  refreshPromise ??= refresh(token).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

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
      // keep-comment: local tokens are cleared regardless
      logger.info("Logout revoke failed", { errorMessage: String(error) });
    }
  }
  await clearTokens();
}

// keep-comment: the API layer's single-flight path, since under token rotation two refreshes log the user out
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
