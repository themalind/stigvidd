<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Keycloak's syslog handler resolves the collector once — absent at start or restarted later, it gets nothing until Keycloak restarts

`docker-compose.yml` first pointed Keycloak's syslog handler at `authevents:5140`
(`KC_LOG_SYSLOG_ENDPOINT`), and the `authevents` collector forwards failed sign-ins to the
OpenObserve stream `keycloak_events` ([observability/otel-auth-events.yaml](../../observability/otel-auth-events.yaml)).
It reads like an ordinary service name that is looked up per connection. It is not: the
JBoss LogManager `SyslogHandler` under Keycloak resolves it **once**, when the handler is
built at startup, and keeps that address for the life of the JVM.

Measured on Keycloak 26.1.5 (`start --optimized`, the image from `keycloak/Dockerfile`),
collector 0.160.0, OpenObserve v0.92.2, rootless podman 5.4 with `docker-compose` 2.26:

| situation | what Keycloak does | events delivered |
| --- | --- | --- |
| `authevents` absent when Keycloak starts | prints `LogManager error of type OPEN_FAILURE: Failed to create syslog handler` / `java.net.UnknownHostException: authevents`, then starts normally | **none, ever** — still none after the collector came up and 20 s passed; delivery began only after `docker compose restart keycloak` |
| `authevents` stopped, then started again | nothing logged at all | **none** — the collector came back on a new IP (`.4` → `.6`); `/proc/net/tcp` in Keycloak showed its socket still pointed at the old one, in `CLOSE_WAIT` |
| `podman restart` of the collector alone | nothing logged | **none** — a plain restart also changed its IP (`.6` → `.8`) |
| Keycloak restarted while the collector runs | — | yes |

In every row sign-in itself was unaffected: failures answered 401 in ~20 ms and the console
log still carried each `LOGIN_ERROR`. That is exactly why this hides: nothing a user or an
operator watches changes. The only symptom is an empty `keycloak_events`, which reads as
"nobody has mistyped a password lately".

## Why the obvious fixes do not work

- **`depends_on` from keycloak to authevents** orders only compose-driven starts. A host
  reboot restarts both through the daemon's restart policy, in no fixed order, and a
  collector restart after a crash is not compose-driven either. The Jenkins deploy also runs
  `up -d --no-deps … keycloak`.
- **UDP instead of TCP** — the handler resolves the address in its constructor regardless
  of protocol; `UnknownHostException` happens before any socket exists.

## The fix that ships: an IP literal on a network of fixed subnet

Pointing the handler at an **IP literal** instead of a name. `docker-compose.yml` gives
`keycloak` and `authevents` a dedicated `authlog` network (`internal: true`, a /29 from
`AUTH_EVENTS_NET_PREFIX`, default `10.213.47`), with keycloak fixed at `.2` and the
collector at `.3`; `KC_LOG_SYSLOG_ENDPOINT` is `<prefix>.3:5140`. Re-measured with that
compose file on rootless podman, 2026-10-03:

| situation | events delivered |
| --- | --- |
| Keycloak started with the collector absent | no error at start; every failure after the collector came up arrived, **no Keycloak restart** |
| collector recreated (`up -d --force-recreate`) while Keycloak ran | same address; **6 of the next 8** arrived, the first ~2 lost into the dead socket |
| feature off (`KEYCLOAK_LOG_HANDLERS` unset, no profile) | keycloak still joins `authlog` at `.2` and starts normally |

Three details that are load-bearing:

- **Keycloak gets a fixed address too.** With only the collector pinned, a keycloak
  recreated while the collector is down could be handed `.3` by dynamic allocation, and
  the collector would then fail to start.
- **The receiver binds `<prefix>.3:5140`, not `0.0.0.0`** (`AUTH_EVENTS_SYSLOG_LISTEN`), so
  no container on `public` can reach it and forge sign-in events.
- **The cost is a fixed subnet on every host.** keycloak always joins `authlog`, feature on
  or off, so a host network overlapping the subnet makes `up` fail for keycloak. The prefix
  is one `.env` knob for that reason, and the default sits outside Docker's default pools
  (172.17–31.x, 192.168.x). The existing `public` network was left alone: giving it a
  subnet would have meant recreating it, i.e. taking the whole stack down.

Before this, the rule was `docker compose restart keycloak` after every `up` or restart
of `authevents`. That rule is retired; a host reboot still deserves the one-failed-sign-in
check in DEPLOYMENT.md Part 1 step 8 **h**.

Related: [[keycloak-26-1-syslog-wire-format]] for what the handler sends once it is
connected, [[deleting-an-openobserve-stream-stops-it-being-recreated]] for another way a
stream goes quiet with a healthy-looking producer.
