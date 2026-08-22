# Observability — Telemetry, Retention & GDPR

How Stigvidd collects telemetry, where it goes, and the rules that keep it lawful.
The stack self-hosts **OpenObserve** at `observatory.<domain>`, behind the same
Caddy proxy as everything else. This is a behavioural reference: it explains _why_
the pipeline is shaped this way, because the failure mode of getting it subtly
wrong is "we retained precise location data about identifiable users for two years."

> This is engineering guidance on building the system to be defensible. It is not
> legal advice — the privacy policy and any DPIA need review by whoever owns that.

## Key files

| Concern                                        | File                                     |
| ---------------------------------------------- | ---------------------------------------- |
| Backend OTel wiring (opt-in guard, filters)    | `backend/StigviddAPI/Extensions/TelemetryExtensions.cs` |
| Readiness probe over the DB                    | `backend/StigviddAPI/Extensions/DatabaseHealthCheck.cs` |
| Service definition, retention + memory caps    | `docker-compose.yml` → `openobserve`     |
| Public routing, ingest/UI split, body cap      | `proxy/Caddyfile`                        |
| Metrics retention override + PII guard         | `scripts/observatory-retention.sh`       |
| Operational runbook (first boot, troubleshooting) | `DEPLOYMENT.md` Part 1 step 8         |
| Deployment variables                           | `.env.example`                           |

## The shape of the pipeline

- **Backend** exports logs, traces and metrics over **OTLP/HTTP**, in-stack and in
  plaintext to `http://openobserve:5080/api/default`. No proxy hop, no
  certificate, no hairpin, no TLS cost on a per-span path.

  `Otlp:Endpoint` is the **org base, with no signal path** — `/v1/logs`,
  `/v1/traces` and `/v1/metrics` are appended per signal in
  `TelemetryExtensions.Configure`. That append is ours on purpose: the SDK only
  does it for the `OTEL_EXPORTER_OTLP_ENDPOINT` *environment variable*, whereas
  assigning `OtlpExporterOptions.Endpoint` in code means "this is the complete
  URL". Get it wrong and every batch POSTs to the org root and OpenObserve
  answers 404 — silently, because export failures never surface as app errors.
  The symptom is simply no data, with a healthy-looking application.
- **Mobile apps** post logs and RUM **straight from devices** over public HTTPS.
  This makes `observatory.<domain>` the first write endpoint in the stack that
  accepts effectively-unauthenticated traffic from the open internet — `media`
  takes public reads but authed writes, `api` requires a Keycloak token, and
  `auth` is Keycloak's own hardened surface. This one is different in kind.
- Telemetry is **opt-in everywhere**: with the config absent, the backend
  registers no OpenTelemetry providers at all and the app initialises no SDK.
  Nothing breaks when observability is unconfigured, or down.

## What the backend emits

Registered only when `Otlp:Endpoint` is set. Verified against a live v0.92.2
instance:

- **Traces** — ASP.NET Core server spans plus `postgresql` child spans. The
  database spans come from `AddSource("Npgsql")`: Npgsql 10 ships its own
  `ActivitySource`, so no `Npgsql.OpenTelemetry` package is needed (that package
  is a two-method shim over exactly this call).
- **Logs** — into `Otlp:LogStream`, carrying `trace_id`/`span_id`, the request
  scope (`requestpath`, `actionname`) and `_originalformat_`, so the existing
  `"{FacilityId}"`-style templates stay queryable rather than collapsing to
  rendered strings. A failing request ties its controller log, repository log and
  EF Core error together under one trace id.
- **Metrics** — ASP.NET Core, HttpClient, .NET runtime and Npgsql. Note this is
  **~70 streams** from one service, since OpenObserve creates one per metric name
  and histograms add `_bucket`/`_count`/`_sum`/`_min`/`_max` variants. That is why
  the retention override is a script rather than a manual UI task.

**Not** emitted, deliberately: spans for `/healthz`, `/readyz`, `/swagger`,
`/openapi` and `OPTIONS` preflights. Health probes alone would otherwise be the
single largest source of spans, forever.

Sampling stays at 100% (`AlwaysOnSampler`). Volume is nowhere near needing
probabilistic sampling, and sampling away spans would destroy the mobile-RUM-to-
server correlation this exists to provide. Volume is controlled by *filtering*
instead. If a head sampler is ever added, it must be `ParentBasedSampler`, or a
sampled mobile request gets dropped server-side.

## Health endpoints

`/healthz` (liveness) and `/readyz` (readiness, checks the database) are
unauthenticated and mapped **before** `UseHttpsRedirection`: the container serves
plain HTTP on 8080 behind Caddy and a Docker healthcheck probes `127.0.0.1`
directly, so a redirect would turn every probe into a 307.

Stopping Postgres correctly yields `readyz` 503 while `healthz` stays 200 —
liveness is not readiness, and conflating them would make Docker restart a
perfectly healthy API whenever the database blipped.

## What the mobile app emits

`app/src/services/logger.ts` replaces the ~70 scattered `console.*` calls in error
paths. **Console output is unconditional and unchanged**, so a migrated call site
behaves identically in Metro — which is what makes converting the remaining ones
risk-free and incremental.

With no sink registered (the default, and the case in Jest and CI) it is a thin
wrapper around console: nothing buffered, nothing scheduled, nothing sent. That is
deliberate and load-bearing: the API tests replace `global.fetch` wholesale and
assert exact call counts, which only works because the logger never calls it.

Batching is 20 records or 10s, capped at 200 buffered so a device offline on a
long hike cannot grow it without bound. It flushes on `AppState` background — the
last reliable moment before the OS may kill the app — and persists whatever did
not make it to AsyncStorage, replaying on next launch. A crash and the last few
log lines before it are usually the same incident.

Global `ErrorUtils` and promise-rejection handlers **chain** rather than replace,
so React Native's red box and (later) the RUM SDK's crash reporting still run.

### Redaction is not optional

Everything passes through `redact()` before it enters the buffer. The rules are
asserted in `app/src/services/__tests__/logger.test.ts` — treat those tests as the
GDPR guarantee in executable form, not as unit-test housekeeping.

Credential-bearing keys are **dropped entirely, never truncated**: a token prefix
is still a fingerprint. Coordinates are dropped rather than rounded, because two
decimals is ~1.1km and a start-of-trace point is plausibly someone's home. Free-form
strings are scrubbed too, since that is where identifiers usually hide — an
upstream error message that embedded the request it failed on.

## Retention: 7 days for logs, 2 years for metrics

OpenObserve has **exactly one global retention default** and no per-stream-*type*
setting. The only finer control is a `data_retention` override on an individual
stream. So a split policy has to be one global default plus overrides on one side.

The global is set to the **low** value (7 days, via `OBSERVATORY_RETENTION_DAYS`)
and `scripts/observatory-retention.sh` raises every *metrics* stream to 730 days.

That looks backwards — metrics are the larger set, since OTel creates **one stream
per metric name** — but it is deliberate, because the two failure modes are not
symmetric:

| Approach                                | A stream that slips through                                          |
| --------------------------------------- | -------------------------------------------------------------------- |
| **Global 7, override metrics → 730** ✅ | A new metric keeps only 7 days. Annoying, bounded, cheap             |
| Global 730, override logs → 7           | A new **log** stream keeps 2 years. Logs are the bulky signal *and* the ones carrying personal data — a disk-full outage and a compliance problem at once |

Fail-safe wins: anything unclassified errs towards a small disk and a short
personal-data lifetime.

### The trap

A metrics stream is created the first time that metric is **ingested**. A stream
that does not exist yet cannot be overridden, so it starts life on the 7-day
global. New metric names appear only when someone adds instrumentation — a
deliberate, reviewable code change — so the rule is:

> **Any change that adds a `Meter`, a counter, or a new instrumentation package
> must be followed by re-running `scripts/observatory-retention.sh` on the host.**

The script is idempotent; re-running it is always safe.

## GDPR

Stigvidd is a Swedish service processing EU residents' data, and the data at stake
is unusually sensitive: **precise GPS traces**. A hike trace reveals where someone
lives, when they are away from home, and their routine.

### The constraint that drives everything: erasure is coarse

**OpenObserve cannot delete records matching a query.** You can delete an entire
stream, or a **time range** (hourly granularity for logs, daily for traces) — and
nothing finer. There is no "delete where user_id = X".

An Art. 17 erasure request therefore cannot be satisfied surgically: deleting one
user's telemetry would mean destroying everyone's data for that time range. So the
design must ensure there is little or nothing in telemetry that needs per-user
erasure. Hence the central rule:

> **Short-retention streams may carry a pseudonymous user id.
> Long-retention streams must carry no personal data at all.**

### Applied to the retention split

| Signal                | Retention | Personal data                                | Basis |
| --------------------- | --------- | -------------------------------------------- | ----- |
| Logs, traces, RUM     | 7 days    | Pseudonymous user id, IP, device/session id  | Legitimate interest (Art. 6(1)(f)) for security and debugging — but RUM additionally needs consent, below. Erasure is satisfied in practice by automatic deletion within 7 days |
| Metrics               | 730 days  | **None. Zero.** This is the *condition* of the 2-year window | Genuinely anonymous aggregate data falls outside GDPR (Recital 26) |

Concretely, for metrics: **no user id, session id, IP, email or coordinates as
metric attributes, ever.** Attributes must be bounded, non-identifying dimensions
only — `http.route`, `http.status_code`, `db.system`.

This coincides exactly with the cardinality discipline the disk budget already
needs: **a high-cardinality metric attribute is almost always a personal
identifier**, so one rule serves both. `scripts/observatory-retention.sh` warns
about identifier-shaped metric fields for this reason; treat a warning as a release
blocker, not a cleanup task.

### Consent

RUM session tracking is **non-essential analytics**. Under the ePrivacy Directive
as implemented in Sweden plus GDPR it requires **informed, prior, opt-in consent**
— it cannot ride on legitimate interest.

The SDK's own examples all pass `TrackingConsent.GRANTED` at init. **Do not copy
that** — it would collect before asking. Instead:

- Initialise with **`TrackingConsent.PENDING`**. Events are held, not transmitted.
- On explicit opt-in, `setTrackingConsent(TrackingConsent.GRANTED)` — buffered
  events are then sent.
- On decline, `TrackingConsent.NOT_GRANTED` — buffered events are **discarded**.
- Persist the choice and make it **revocable in Settings**. Withdrawal must be as
  easy as giving consent (Art. 7(3)).

**Crash reporting and error logs are defensible on legitimate interest** — they are
necessary to keep the service working, which users reasonably expect. Keep them
separable from session/interaction tracking so consent can gate the analytics
without disabling the safety net.

### What must not be logged

Enforced in one place — a `redact()` helper applied to every log context, plus the
RUM SDK's event mappers, which scrub on-device so nothing unredacted ever leaves.

| Data                                      | Rule |
| ----------------------------------------- | ---- |
| Tokens, `Authorization` headers, passwords | **Drop the key entirely.** Never truncate — a prefix is still a fingerprint |
| Email addresses                            | `***@domain`. The address is directly identifying; the domain alone is not |
| Keycloak subject id                        | Keep **only in 7-day streams**. Pass to `setUserInfo({ id })` — never `email`/`name` |
| **GPS coordinates**                        | **Never log a position.** Log *shape* only: `pointCount`, `accuracy`, `distanceMeters`. This rule is absolute — "round to 2 decimals" is not good enough for a start-of-trace point, which is plausibly someone's home |
| Request/response bodies                    | Never. Method + path + status + a stable `endpoint` label |
| IP address                                 | Personal data (CJEU *Breyer*). Unavoidable in RUM; bounded by the 7-day window. Must never reach a metrics stream |

Backend-side, the good defaults mostly need **not breaking**:
`AspNetCoreTraceInstrumentationOptions.DisableUrlQueryRedaction` defaults to
`false`, so query values are recorded as `Redacted`. That matters more than it
looks — `app/src/api/trails.ts` sends real coordinates as query parameters, so that
default is what currently keeps user positions out of spans. Leave it alone, and do
not set the experimental env var that disables it. Npgsql spans exclude parameter
values unless `EnableParameterLogging` is on; leave it off.

### What self-hosting already gets right

Worth recording, because it is a real advantage over a SaaS APM:

- **No third-country transfer.** Telemetry never leaves the VPS. No Art. 46
  transfer mechanism, no SCCs, no US-processor exposure.
- **No third-party processor**, so no Art. 28 data processing agreement.
- **`ZO_TELEMETRY: "false"`** stops OpenObserve phoning home to zinclabs (US).
  With the default `true` that would itself be an outbound transfer — a second,
  independent reason that setting is not optional.

### Remaining obligations

1. **Account deletion and telemetry.** The app has a delete-account flow, and it
   leaves telemetry behind. Given no delete-by-query exists, the defensible answer
   is: telemetry carries only a pseudonymous id, that id is meaningless once the
   account is gone, and it ages out within 7 days. That reasoning is the answer to
   give a data subject, and it needs to be written down *before* someone asks.
2. **Privacy policy** must disclose telemetry: what is collected, the legal basis,
   the 7-day/2-year split, and that it is self-hosted in the EU.
3. **Art. 30 record of processing** — add telemetry as a processing activity.
4. **Access control.** `observatory.<domain>` exposes 7 days of pseudonymous user
   activity to anyone who can log in. The root password is a personal-data access
   credential, not just an ops one.
5. **A DPIA is plausibly required for the product** (Art. 35 — systematic
   monitoring, location data at scale). Keeping positions out of telemetry entirely
   is what stops the observability work widening that scope.

## Security posture

The app's RUM client token is **public**: it ships in every APK/IPA and can be
extracted in minutes. There is no way to make direct-from-device RUM not have this
property; the question is only how much a stolen token buys.

1. **Three separate identities** — root (UI only), the backend's ingest account
   (server-side only), and the app's RUM client token (public). A stolen client
   token must not be able to *read* telemetry or change configuration. Verify what
   a `Member` can actually see: OSS RBAC is coarser than Enterprise.
2. **Retention as blast-radius cap.** An abuser cannot fill the disk forever, only
   up to `retention × their rate`. Note that garbage written into a *metrics*
   stream would sit for two years — if the token is ever abused, look for junk
   metric streams specifically and delete them rather than waiting for retention.
3. **`request_body max_size 10MB`** in the Caddyfile caps a single request.
4. **`ZO_INGEST_ALLOWED_UPTO` / `_IN_FUTURE`** bound timestamp spoofing, so nobody
   can plant events years out to evade retention or pollute dashboards.
5. **No Caddy access log on the ingest paths** — beyond the disk cost,
   access-logging a write endpoint an attacker controls is a log-injection surface.
6. **Rate limiting is the honest gap.** Caddy OSS has no built-in `rate_limit`; it
   is the third-party `mholt/caddy-ratelimit`, which means converting
   `proxy/Dockerfile` to an `xcaddy` build stage — a Go build in a currently-instant
   image build, and a third-party module in the TLS-terminating path. Not worth it
   on day one. The trigger should be evidence: anomalous volume growth or garbage
   streams.

## Local development

Telemetry is off unless configured, so nothing is needed by default. To see your
own traces and logs locally, run the same image production uses — see the
**Telemetry** section of the root `README.md`.
