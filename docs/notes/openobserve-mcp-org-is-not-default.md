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
