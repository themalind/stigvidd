---
name: one-phone-trips-the-app-failures-alert
description: app_events_areas_failures (count >= 3) fires on ONE device's own retries; how to tell, and what the app now logs
metadata:
  type: project
---

# One phone's retries alone satisfy `app_events_areas_failures`

The alert counts `stigvidd_app_logs` rows (>= 3 in 30 min), and `send()` in
`app/src/api/core/request.ts` logs **every failed attempt**. `retryUnlessAuthFailure`
(`app/src/api/core/unauthorized.ts`, `MAX_RETRIES = 3`) retries a query up to three times, so one
failed `getAreas` is 3 to 4 rows. A single flaky phone therefore trips an alert that reads as
"3 users failed".

Measured 2026-11-23: three `getAreas failed` rows, `HTTP error: getAreas: 504`, at 19:58:49.206,
:50.229 and :52.266 UTC. The gaps are 1.0 s and 2.0 s (React Query's backoff), so each retry itself
failed within 20 to 40 ms. All were one Android 30 device on app 1.1.0 build 18. The API had no
trace of the three calls, while the same device's other calls got 200 in milliseconds before,
between and after, so the 504 did not come from the API. Caddy has no `log` directive and
OpenObserve has no proxy stream, so Caddy itself was neither confirmed nor cleared.

## Shortcut for the next mail

1. `ListAlerts` with `detail: "full"`: `last_satisfied_at` (microseconds) is the evaluation time.
2. `SearchSQL` the alert's own predicate on `stigvidd_app_logs` over the 30 minutes before it.
3. Row spacing of about 1 s then 2 s means one query's retries, not several users.
4. `stigvidd_app_logs` has no device or user id, only `appversion`, `buildnumber`, `platform` and
   `osversion`. The trace stream does carry `client_device_model`. Join on time to the device's
   successful calls.
5. No API trace for the failing path while that device's other calls succeed: the failure was
   upstream of the API (proxy, or the phone's own network).

## What the log now says

Since the change that added it, a failed call's row also carries `status`, `server`, `via` and
`elapsedMs`. `server: Caddy` means our proxy answered, a `via` header means a middlebox in the path,
and a small `elapsedMs` means a refusal rather than a timeout. Only builds with that OTA have it.

Not done: logging only the final failure per query, or counting distinct
`platform/buildnumber/osversion` in the alert, which would stop one device firing it. A Caddy access
log was weighed and left out ([observability.md](../observability.md), "No Caddy access log on the
ingest paths", and access logs carry IPs).

The `EventsController: the token carries no subject id.` Information lines seen around the same
time are anonymous callers, not part of this. That one now logs at Debug (`StigViddController.cs`).
