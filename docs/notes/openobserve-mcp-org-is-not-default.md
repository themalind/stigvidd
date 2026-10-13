# The OpenObserve MCP wants the org id from its URL, not `default`, and answers 401 when given `default`

**Symptom.** `mcp__openobserve__StreamList` (and every other OpenObserve MCP tool) with
`org_id: "default"` returns `Error 401: Unauthorized Access`. That looks like a bad or
passcode-only credential (see [[openobserve-oss-has-no-rbac]], where `_search` really does
401 for an ingestion token), so the natural next step is to go hunting for a password.
That step is wrong: the credential is fine.

**Cause.** The MCP server is configured (user-level, in `~/.claude.json` under this project's
`mcpServers.openobserve`) with the URL
`https://observatory.stigvidd.se/api/3Igh0Ez9tpaLNBgzzVouYA1NyT5/mcp`. The path segment is
the org the MCP is scoped to, and the tools only accept that id:
`org_id: "3Igh0Ez9tpaLNBgzzVouYA1NyT5"` works on the first try. `.env.example`'s
`OBSERVATORY_ORG=default` is the org the API and apps *ingest* into over HTTP. It is not
the id the MCP endpoint takes, so reading the repo points you at the wrong value.
Measured 2026-09-27.

## Investigating app 401s from it (what worked, 2026-09-27)

- **Streams:** logs `stigvidd_app_logs` (fields `level, endpoint, message, errormessage`),
  `stigvidd_api_logs`, and traces stream `default`. Times are **microseconds**.
- **`agent_options.output_format: "csv"` returned `hits: []` with a non-zero `total`.**
  Plain JSON returned the rows. Do not read an empty CSV result as "no data".
- **Traces identify the client, not the user.** The Android app's `user_agent_original` is
  `okhttp/4.12.0`, and iOS shows as a CFNetwork/Safari string. Spans carry no user id or
  client IP, so "one device or everyone?" has to be read from whether 200s interleave with
  the 401s in the same 5-minute bucket.
- **Check for a restart first.** Group the traces by `service_service_instance_id` and
  `service_service_version`, and look at the `container_cpu_utilization` `start_time` per
  container (`stigvidd-api-1`, `stigvidd-keycloak-1`, `stigvidd-proxy-1`). A constant value
  rules out a restart or deploy.
- **The API's 401 reason** only reaches `stigvidd_api_logs` because
  `Microsoft.AspNetCore.Authentication.JwtBearer` is set to `Information` in
  [appsettings.json](../../backend/StigviddAPI/appsettings.json). Under the blanket
  `Microsoft.AspNetCore: Warning` it was silent. The app's side is `Token refresh failed`
  in `stigvidd_app_logs`.

That day's incident and its fix: [[android-fetch-no-timeout-stale-token-401]].

## A 401 *at connect*, before any tool call, is the credential, not the org (2026-10-13)

If the session starts with `openobserve (AUTH_HEADER_REJECTED)`, no `org_id` was ever sent.
Test the header itself: `curl -H "Authorization: Basic …" https://observatory.stigvidd.se/api/organizations`
takes no org, so a 401 there means the server rejects the username and secret pair.
That day the `mcp@stigvidd.se` user had been deleted from OpenObserve, and nobody knows why.

**The value the OpenObserve MCP page prints does not work.** Recreating the user and copying
`claude mcp add … --header "Basic …"` from its MCP page gives `mcp@stigvidd.se:o2oi_…`. That
secret is the **passcode** (ingestion token), and on OSS a passcode returns 401 on every read
([[openobserve-oss-has-no-rbac]]). The header must be `Authorization: Basic base64(mcp@stigvidd.se:<login password>)`,
and the page's command also omits the `Authorization:` header name.

**The session does not reconnect by itself.** After fixing the config, use `/mcp` → reconnect.
In the meantime, the same header works with plain curl on `$ORG/_search?type=logs|traces`
(SQL body, µs `start_time`/`end_time`). Use `"default"` (quoted) as the traces stream, with
`url_path`, `http_request_method`, `http_response_status_code` and `user_agent_original`:
that one query reconstructs who did what, in order.

## Staging is a second org, so a second MCP server (2026-10-13)

Staging ([STAGING.md](../../STAGING.md)) ingests into its own org on the same instance,
`3KeRfxpDWf9Hf2CiVsulKJpHWTL`. The production server's URL pins the production org, so
`org_id: "3KeRfx…"` through `openobserve` is a 401. `~/.claude.json` therefore has a second
entry, `openobserve-staging`, at `…/api/3KeRfxpDWf9Hf2CiVsulKJpHWTL/mcp` with the **same**
`mcp@stigvidd.se` header, which is a login password and so is not tied to an org.

A 401 from `openobserve-staging` with a header that works on production means
`mcp@stigvidd.se` is not a **member** of the staging org. Check with
`curl -H "Authorization: …" https://observatory.stigvidd.se/api/3KeRfxpDWf9Hf2CiVsulKJpHWTL/streams`.
Fix: in the staging org, IAM → Users → add `mcp@stigvidd.se`, then `/mcp` reconnect.
