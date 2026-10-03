<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Keycloak 26.1 syslog puts a BOM before the JSON, the logger name in MSGID, and has no octet-counting option

Keycloak's log options were renamed and extended across 26.x, and most of what is written
about its syslog handler describes a later release. What the image this repo pins
(`quay.io/keycloak/keycloak:26.1`, which is **26.1.5**) actually accepts and sends, measured
with `kc.sh start --help-all` and a raw `nc -l` capture:

## Options that exist in 26.1

`log` (`console,file,syslog`), `log-syslog-endpoint`, `-protocol` (`tcp`, `udp`, `ssl-tcp`),
`-output` (`default`, `json`), `-level` (per-handler, default `all`), `-type` (`rfc5424`,
`rfc3164`), `-max-length` (default **2048** bytes for rfc5424), `-app-name`, `-format`,
`-include-trace`. There is **no** counting-framing option — over TCP it sends one message per
line, LF-terminated, with no octet-count prefix. So the collector's `syslog` receiver keeps
`enable_octet_counting: false` (its default newline split); turning it on makes every message
unparseable.

All of these are runtime options: with `start --optimized` they need no image rebuild and
print no build-time warning. With the `syslog` handler **not** enabled, every start prints a
non-fatal `WARNING: The following used run time options are UNAVAILABLE and will be ignored
during build time:` listing each `log-syslog-*` set in the environment. Expected when
`KEYCLOAK_LOG_HANDLERS` is unset.

SPI options are not in `--help-all` at all. The `jboss-logging` event listener's keys, read
from `JBossLoggingEventListenerProviderFactory` in `keycloak-services-26.1.5.jar`, are
`success-level` (default `debug`), `error-level` (default `warn`), `sanitize`, `quotes`. The
26.1 spelling `KC_SPI_EVENTS_LISTENER_JBOSS_LOGGING_SUCCESS_LEVEL` was proven to bite: set to
`warn`, a successful password grant logged `type="LOGIN"` at WARN; at the default, nothing.
Do not copy an SPI spelling from a newer release's docs without the same check.

## What arrives

```text
<12>1 2026-10-03T11:59:28.306+00:00 3c6cbf73243a keycloak 1 org.keycloak.events - \xEF\xBB\xBF{"timestamp":…,"loggerName":"org.keycloak.events","level":"WARN","message":"type=\"LOGIN_ERROR\", realmId=…, username=\"…\"",…}
```

- **MSGID is the logger name.** The OTel `syslog` receiver surfaces it as
  `attributes["msg_id"]`, so filtering to `org.keycloak.events` needs no parsing.
- **A UTF-8 BOM precedes the JSON** (RFC 5424 allows it). The receiver keeps it in
  `attributes["message"]`, and OTTL `ParseJSON` then fails with `invalid character 'ï'
  looking for beginning of value`. Strip it first:
  `replace_pattern(…, "^\\x{FEFF}", "")`.
- A typical `LOGIN_ERROR` line is ~750–800 bytes, inside the 2048 default, but the username
  is caller-controlled; a line cut at `max-length` is broken JSON. The compose file raises it
  to 8192.
- Keycloak escapes quotes inside values: a username typed as `a", userId="spoof` arrives
  as `username="a\", userId=\"spoof"`. OTTL `ParseKeyValue(…, "=", ", ")` honours that
  escaping — the forged `userId` stayed inside `username` and the real `userId` was kept.
- `userId` is the literal string `"null"` when no account matched (`user_not_found`).
- A successful password-grant sign-in produced **no** line at all at the default levels:
  `success-level=debug` is below the root `info`.

Related: [[keycloak-syslog-resolves-the-collector-once]] for the delivery trap,
[[openobserve-oss-has-no-rbac]] for the ingestion token the collector carries.
