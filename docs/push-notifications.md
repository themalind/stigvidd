# Push Notifications — Full Flow & Behavior

How push notifications work end to end: registering a device, sending from the
backend through Expo, and what happens when one arrives or is tapped. This is a
behavioral reference — it explains the ordering traps and the _why_ behind the
retry/cleanup logic, on both the client and the server.

## Key files

| Concern                                         | File                                                         |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Client register/unregister + payload→route maps | `app/src/services/notifications.ts`                          |
| Client token API calls                          | `app/src/api/notifications.ts`                               |
| Foreground receive + tap navigation             | `app/src/app/_layout.tsx`                                    |
| Backend send/register/unregister via Expo       | `backend/Core/Services/ExpoPushService.cs`                   |
| Token persistence                               | `backend/Core/Repositories/UserPushTokenRepository.cs`       |
| HTTP endpoints                                  | `backend/StigviddAPI/Controllers/NotificationsController.cs` |

## The pipeline at a glance

```
 device                        our backend                 Expo                 device
 ──────                        ───────────                 ────                 ──────
 register token  ── POST ──►  UpsertAsync (DB)
                              ...later, a friend request...
                              SendToUserAsync
                                get tokens for user
                                batch (≤100) ── POST push/send ──► fan-out ──► notification
                                read tickets ◄── DeviceNotRegistered → delete token
```

The app uses **Expo Push** (`exp.host`), not raw APNs/FCM. Expo holds the APNs/FCM
credentials for our EAS project (`projectId f436d9c7-…`) and routes each message to
the right platform transport.

## Client: registering a device (`registerForPushNotificationsAsync`)

Called from `_layout.tsx` **once the user is signed in** (`if (!user) return`), and
safe to call on every launch — it re-registers gracefully. Order matters:

1. **Android channel first.** Android needs a notification channel (`"default"`,
   MAX importance) created **before** permission is requested, or notifications can't
   display.
2. **Physical-device guard.** Expo push tokens are only issued for real devices;
   simulators/emulators have no APNs/FCM identity and would throw. Bail out quietly.
3. **Permission — check before prompting.** iOS only shows the system dialog **once**;
   if the user previously denied, re-requesting won't re-prompt. So read
   `getPermissionsAsync()` first and only `requestPermissionsAsync()` if not already
   granted. Denied → return quietly.
4. **Fetch the Expo token** with our `projectId`. This hits `exp.host`; a transient
   network failure is **not fatal** — bail out quietly so the next launch retries,
   rather than surfacing an unhandled error.
5. **Persist to backend** (`POST /notifications/tokens` with `{ expoToken, platform }`).
6. **Token-rotation listener.** `addPushTokenListener` re-registers automatically if
   the token rotates. Any previous listener is removed first to avoid duplicates
   across login/logout cycles.

`unregisterForPushNotificationsAsync` (called on **logout**) removes the listener and
`DELETE`s the current token from the backend, so a signed-out device stops receiving
pushes. It's best-effort — logout swallows its failure.

## Client: receiving & tapping (`_layout.tsx`)

Two data-driven maps in `notifications.ts` keep behavior declarative:

- `NOTIFICATION_QUERY_KEYS`: `data.type` → the React Query key to invalidate.
- `NOTIFICATION_ROUTES`: `data.type` → the screen to navigate to on tap.

| `data.type`               | Invalidates              | Route on tap          |
| ------------------------- | ------------------------ | --------------------- |
| `friend_request`          | `["friends","incoming"]` | `…/user/friends`      |
| `friend_request_accepted` | `["friends"]`            | `…/user/friends`      |
| `hike_share`              | `["shared-hikes"]`       | `…/user/shared-hikes` |

Two listeners:

- **Foreground receive** (`addNotificationReceivedListener`) — a notification arriving
  while the app is open just **refreshes data** (invalidate the mapped query key). No
  navigation — the user didn't ask to go anywhere.
- **Tap / cold-start tap** (`useLastNotificationResponse`) — a background or
  cold-start tap invalidates the query key **and** navigates to the mapped route,
  after `user` is resolved. A `handledNotificationId` ref guards against
  re-navigating if the app is restarted after a tap (the last response persists).

The foreground banner presentation is set globally via `setNotificationHandler`
(banner + list, no sound, no badge).

## Backend: sending (`ExpoPushService.SendToUserAsync`)

Triggered by domain events (e.g. a friend request creates one `SendToUserAsync` call).
Steps:

1. Resolve the user id from the identifier (404 if unknown).
2. Load **all** the user's registered Expo tokens. **One token = one device**; a
   single event fans out to all of the recipient's devices (usually one).
3. Build one `ExpoPushMessage` per token and **chunk into batches of 100** (Expo's
   recommended batch size).
4. `POST` each batch to Expo's push endpoint.
5. **Correlate tickets back to messages by index.** Expo preserves order, so
   `batch.Zip(tickets)` pairs each sent message with its ticket — `ticket.Id` is
   Expo's receipt id, _not_ the token, so the zip is the only way to know which token
   a failure belongs to.
6. **Act on failures:**
   - `DeviceNotRegistered` → the app was uninstalled or the token revoked → **delete
     the token** so future sends skip it.
   - Any other error (`InvalidCredentials`, `MessageTooBig`, …) → log a warning; no
     cleanup needed, but it needs attention without failing the caller.

The whole send is best-effort: a failed batch is logged and skipped (`continue`), and
the method returns `Result.Ok` unless an unexpected exception occurs — a
notification-send failure should not fail the originating action (making a friend
request still succeeds even if the push doesn't).

### Expo access token

If `ExpoPush:AccessToken` is configured, it's attached once as a Bearer header on the
shared `HttpClient`. Without it requests still work but Expo rate-limits more
aggressively.

### Message shape

`ExpoPushMessage { To, Title, Body, Data, Sound="default", ChannelId="default" }`.
`ChannelId` is ignored on iOS and routes Android to the named channel created during
client registration.

## Backend: register / unregister

- **Register** (`RegisterTokenAsync`) → **upsert** by user+token, so re-registering the
  same device is idempotent (no duplicate rows).
- **Unregister** (`UnregisterTokenAsync`) verifies the token exists for the user
  (404 if not) before deleting, for accurate feedback.

## Edge cases — quick reference

| Scenario                                     | Behavior                                            |
| -------------------------------------------- | --------------------------------------------------- |
| Simulator / emulator                         | Registration skips (no push identity); no crash.    |
| Permission previously denied on iOS          | No re-prompt; registration returns quietly.         |
| Expo token fetch fails (network)             | Bail quietly; retried next launch.                  |
| Token rotates while app is running           | Listener re-registers the new token automatically.  |
| App uninstalled (server learns on next send) | `DeviceNotRegistered` ticket → token deleted.       |
| Notification arrives in foreground           | Data refreshed; no navigation.                      |
| Notification tapped (background/cold)        | Data refreshed **and** routed to the mapped screen. |
| App restarted after a tap                    | `handledNotificationId` prevents re-navigation.     |
| Recipient has multiple devices               | Fan-out: one message per token.                     |
| Push send fails                              | Logged; the originating action still succeeds.      |
| User logs out                                | Token removed from backend; listener cleaned up.    |

## Adding a new notification type

1. Backend: call `SendToUserAsync(user, title, body, data)` with `data["type"] = "…"`.
2. Client: add the type to `NOTIFICATION_QUERY_KEYS` (what to refresh) and, if it
   should deep-link, `NOTIFICATION_ROUTES` (where to go on tap).

That's it — the listeners in `_layout.tsx` are fully data-driven off those maps.
