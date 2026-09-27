# Android fetch has no timeout, and a failed refresh used to hand out the expired token: "Inte inloggad" while the drawer says "Logga ut"

**Symptom (field report 2026-09-27, Android S936B, 1.0.0, mid-recording).** The app spun, then the
profile tab showed "Inte inloggad – Du måste logga in för att fortsätta" while the drawer still
offered "Logga ut", so there was no way to log in without logging out first. Logging out and in
fixed it for a few minutes. "Stäng alla" gave a profile with no name or e-mail and a failing save,
then the screen was replaced again. Then it "suddenly worked". An iPhone on the **same network**
(the Android's hotspot) had no problems. The GPS track came out whole.

**The screen was not the signed-out state.** "Inte inloggad" is `ErrorView` for an `ApiError` with
status 401 (`app/src/components/error-view.tsx`). `userAtom` was still set, so the drawer showed
"Logga ut". Name and e-mail come from `GET /users`, which also got 401.

**Two mechanisms, both verified in the source:**

1. **No timeout on Android.** `node_modules/react-native/ReactAndroid/.../OkHttpClientProvider.kt`
   builds OkHttp with `connectTimeout(0)`, `readTimeout(0)` and `writeTimeout(0)`, meaning "wait
   forever". The app added none. Every API call awaits the one shared `refreshPromise` in
   `app/src/services/keycloak-auth.ts`, so one hung refresh stalls everything. iOS's
   `NSURLSession` defaults to 60 s, which is why the iPhone was unaffected. That the connection was
   a pooled one silently dropped by the carrier NAT or a 5G handover is the likely cause, but it is
   **not measured**: logcat's 5 MB main buffer had already rolled past the incident.
2. **A failed refresh returned the expired token.** `getValidAccessToken` did
   `refreshGrant(token).then(() => accessToken)`. After a transient failure `accessToken` was
   still the old, expired value, so it was sent to the API → 401. `restoreSession` decoded the same
   token, which is why a "restart" looked signed in.

**"Stäng alla" is not a cold start during a recording.** The recording's foreground service keeps
the process alive, so in-memory token state survives. `adb shell dumpsys activity exit-info
com.stigvidd.app` (kept far longer than logcat) showed the last process death at 10:38:30. The same
pid ran through the whole incident.

**Fix.**
- `withTimeout` (`TOKEN_REQUEST_TIMEOUT_MS`, 15 s) on the token and logout requests.
- `getValidAccessToken` throws `SessionUnavailableError` instead of returning a stale token.
  `ErrorView` shows it as a connection problem.
- `restoreSession` keeps the stored identity offline, but never sends that token.
- `handleUnauthorized()` forces a refresh:
  - "refreshed" → `SessionRecovery` (`app/src/components/auth/session-recovery.tsx`, which
    subscribes to the query and mutation caches) runs `invalidateQueries()`;
  - "expired" → the session-expired handler signs the user out;
  - "unavailable" → nothing;
  - a 401 within 30 s of a successful forced refresh is "rejected", not another refresh, which
    would loop.
- `withUnauthorizedRetry` retries the hike save once.
- `retryUnlessAuthFailure` stops React Query from retrying 401s.
- A 401 `ErrorView` shown to a signed-in user has a "Logga in igen" button.
- `create-hike.tsx` no longer swaps `TrailCreator` for `ErrorView` when `GET /users` fails.

The recording itself was never at risk. It lives in AsyncStorage (`@stigvidd_active_hike`) and is
cleared only by `resetTracking()` after a successful save or an explicit discard.

Plain API calls (`app/src/api/*.ts`) still have no timeout; only the token requests do.
