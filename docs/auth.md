# Authentication & Session — Full Flow & Behavior

How sign-in, session persistence, token refresh, and sign-out work end to end.
The app talks to **Keycloak** directly using the **Direct Access Grant** (password)
flow — no OIDC library — and the backend validates the resulting JWTs. This is a
behavioral reference: it explains _why_ the code is shaped this way, because the
failure mode of getting it subtly wrong is "every user gets silently logged out."

## Key files

| Concern                                                | File                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| Token service: grants, refresh, storage, single-flight | `app/src/services/keycloak-auth.ts`                                     |
| Auth state + actions (login/register/logout/delete)    | `app/src/components/auth/auth-provider.tsx`                             |
| Auth atoms (`userAtom`, `authLoadingAtom`)             | `app/src/atoms/auth-atoms.ts`                                           |
| Account provisioning + password reset                  | `app/src/api/auth.ts`                                                   |
| Access-token accessor for the API layer                | `app/src/api/users.ts` → `getUserToken`                                 |
| API base URL                                           | `app/src/api/api-config.ts`                                             |
| Realm-role → `[Authorize(Roles=…)]` mapping (backend)  | `backend/StigviddAPI/Authorization/KeycloakRealmRolesTransformation.cs` |

## Why Direct Access Grant (password flow)

The app posts the user's email + password straight to Keycloak's token endpoint and
gets back tokens. **No OIDC/PKCE browser redirect, no OIDC library.** The mature
React Native OIDC libraries deliberately omit the password grant (it's deprecated in
OAuth 2.1), so instead of fighting them we call the token endpoint with `fetch` and
persist tokens ourselves. The app uses the **public** `stigvidd-app` client, so no
client secret is ever sent from the device.

Endpoints are derived from `EXPO_PUBLIC_OIDC_URL` / `_OIDC_REALM` / `_CLIENT_ID`:

```
{OIDC_URL}/realms/{REALM}/protocol/openid-connect/token    ← password + refresh grants
{OIDC_URL}/realms/{REALM}/protocol/openid-connect/logout   ← session revoke
```

## Tokens: what's stored and where

| Token                        | Lifetime governed by                              | Stored in               |
| ---------------------------- | ------------------------------------------------- | ----------------------- |
| **Access token** (JWT)       | Keycloak "Access Token Lifespan" (short, minutes) | SecureStore + in-memory |
| **Refresh token** (offline)  | realm **Offline Session** settings (long-lived)   | SecureStore + in-memory |
| `accessExpiresAt` (epoch ms) | derived from `expires_in`                         | SecureStore + in-memory |

- **Persistence** is `expo-secure-store` (Keychain / Keystore), under keys
  `kc_access_token`, `kc_refresh_token`, `kc_access_expires_at`.
- **In-memory cache** (`accessToken`, `refreshToken`, `accessExpiresAt` module vars)
  exists so the hot path — every API call — doesn't touch SecureStore. `loadTokens()`
  hydrates memory from storage once at startup.

### Why `offline_access` scope

Login requests `scope = "openid profile email offline_access"`. The `offline_access`
part asks Keycloak for an **offline** refresh token. Without it, Keycloak issues an
_online_ refresh token bound to the SSO session, which dies on the realm's **SSO
Session Idle** (default 30 min) / **Session Max** (default 10 h) timeouts — i.e. the
user gets silently logged out after a short time. The offline token's lifetime is
governed instead by the realm's **Offline Session** settings, letting the session
persist long-term across app launches.

## The single choke point: `getValidAccessToken()`

Every authenticated API call routes through `getUserToken()` → `getValidAccessToken()`.
It returns a valid access token, refreshing transparently when needed:

```
getValidAccessToken():
  no access AND no refresh token?        → null   (signed out)
  access token still valid (with skew)?  → return it
  no refresh token?                      → null
  otherwise                              → refresh (single-flight), return new access
```

- **Expiry skew.** A token is treated as expired `EXPIRY_SKEW_SECONDS` (30 s) _before_
  its real expiry, so a call never goes out with a token about to die mid-flight.
- **Single-flight refresh.** Concurrent callers share **one** in-flight refresh via
  a module-level `refreshPromise`. This is critical under Keycloak **refresh-token
  rotation**: each refresh invalidates the old refresh token, so two concurrent
  refreshes with the same token would make the second fail with `invalid_grant` and
  log the user out. One shared promise means one rotation.

## Session restore on startup (`restoreSession` + `useInitAuth`)

`useInitAuth()` runs once near the root, **outside any conditional render**, so it
executes even while the first paint is gated on auth resolving (`authLoadingAtom`).
It:

1. Registers the **session-expired handler** (see below).
2. Calls `restoreSession()`, which `loadTokens()` then obtains a token through the
   **same single-flight `getValidAccessToken()`** the API layer uses. This is
   deliberate: the startup refresh and any concurrent first API calls share **one**
   refresh request, so rotation can't log the user out on a cold start.
3. Sets `userAtom` (decoded user or `null`) and flips `authLoadingAtom` to `false`.

`authLoadingAtom` gating avoids an auth-resolution blink (login screen flashing
before the restore completes).

## Transient failure vs genuine rejection (the logout trap)

`refreshGrant()` distinguishes two failure kinds, and this distinction is the whole
ballgame:

- **Genuine rejection** — Keycloak returns `400`/`401` (`invalid_grant`), surfaced as
  `InvalidCredentialsError`. The refresh token is truly dead → **clear tokens** and
  fire `onSessionExpired`.
- **Transient failure** — network error, timeout, 5xx. These must **NOT** clear the
  stored tokens. A momentary connectivity blip would otherwise permanently sign the
  user out. Tokens are left intact so a later call retries.

`requestToken()` only throws `InvalidCredentialsError` on 400/401; every other
non-OK status throws a plain `Error` (transient).

### The session-expired handler

`setSessionExpiredHandler` registers a callback (from `useInitAuth`) fired when a
refresh genuinely fails mid-session. It sets `userAtom = null` and clears the query
cache, so the route guards swap to the login screen instead of stranding the user on
a screen whose API calls all 401. Registered once; cleared on unmount.

## Auth actions (`useAuth`)

State lives in **Jotai atoms**, not React Context — so `useAuth()` works identically
even when read from the component that renders the bootstrap (e.g. `RootLayout`). It
reads the QueryClient from `queryClientAtom` rather than `useQueryClient()` for the
same reason: `useAuth()` runs in `RootLayout`, which sits _above_ the
`QueryClientProvider`, so `useQueryClient()` would throw.

| Action            | Flow                                                                                                                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **login**         | `passwordGrant(email, pw)` → persist tokens → `setUser`                                                                                                                                                                                  |
| **register**      | Backend provisions Keycloak user + StigVidd DB record (`/account/register`), then auto-login. A login failure _after_ successful provisioning throws `RegisteredButLoginFailedError` so the screen routes to login, not a generic error. |
| **logout**        | Unregister push token (best-effort) → `logoutKeycloak()` (revoke at Keycloak + clear tokens) → `setUser(null)` → `queryClient.clear()`                                                                                                   |
| **deleteAccount** | Re-verify identity via `passwordGrant` (throws on wrong pw) → backend deletes DB + Keycloak user → `logout()`                                                                                                                            |

Note register/reset live in `api/auth.ts` and hit the **backend** (which calls the
Keycloak Admin API), not Keycloak directly — the device never holds admin
credentials. Password reset always resolves 2xx (the backend won't reveal whether an
email exists).

## Backend: validating the token & roles

The API validates the Keycloak JWT as a bearer token (JWT bearer auth in
`Program.cs`). `KeycloakRealmRolesTransformation` (an `IClaimsTransformation`) then
flattens Keycloak's `realm_access` claim (`{"roles":["admin",…]}`) into standard
`ClaimTypes.Role` claims, so `[Authorize(Roles = "admin")]` and role policies work.
A malformed claim leaves the principal unchanged rather than throwing.

## Edge cases — quick reference

| Scenario                                           | Behavior                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| App relaunched with a valid offline refresh token  | `restoreSession` refreshes silently; user stays signed in.         |
| Access token expired, refresh valid                | Transparent refresh on the next API call (single-flight).          |
| Two API calls race with an expired access token    | Share one refresh promise; only one rotation happens.              |
| Refresh token genuinely rejected (`invalid_grant`) | Tokens cleared, `onSessionExpired` → login screen.                 |
| Network blip during refresh                        | Tokens **kept**; retried later. User not logged out.               |
| Wrong password on login / delete                   | `InvalidCredentialsError` surfaced to the screen.                  |
| Register succeeds but auto-login fails             | `RegisteredButLoginFailedError` → route to login (account exists). |
| Logout                                             | Session revoked at Keycloak, tokens wiped, query cache cleared.    |
| SSO idle/max timeout                               | Irrelevant — offline token isn't bound to the SSO session.         |

## Tunable constants (`keycloak-auth.ts`)

| Constant              | Value                                 | Meaning                                                           |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| `SCOPE`               | `openid profile email offline_access` | `offline_access` is what makes the session long-lived.            |
| `EXPIRY_SKEW_SECONDS` | 30 s                                  | Refresh this long before actual expiry to avoid mid-flight death. |
| `STORAGE_KEYS`        | `kc_*`                                | SecureStore keys for the three persisted values.                  |
