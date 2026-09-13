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
| Host + container metrics collector             | `observability/otel-hostmetrics.yaml`, `docker-compose.yml` → `hostmetrics` |
| Host container log retention (a separate 7 days) | `scripts/container-log-retention.sh`, `x-logging` in `docker-compose.yml` |
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
- **The admin web** posts logs the same way, to `stigvidd_web_logs`, from
  `web/src/services/telemetry.ts`. Same bulk `_json` endpoint as the app, same
  credential shape, and one difference that matters: its token is inlined by Vite
  into a bundle served publicly from the web domain, so extracting it needs a
  single `curl` rather than an APK. `ZO_CORS_ALLOWED_ORIGINS` already permits the
  web domain, which is what makes a browser-side POST possible at all.
- **The host itself** is reported by an optional OpenTelemetry Collector, the
  `hostmetrics` service, over the same in-stack OTLP/HTTP path the backend uses.
  Everything above measures the *application*; this is the only thing that measures
  the *machine*. See **Host and container metrics** below.
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
  the retention override is a script rather than a manual UI task. The optional
  `hostmetrics` collector adds **~36 more** (measured, see below), so a host with it
  enabled carries a little over a hundred metrics streams.

  Plus the application's own meter, **`Stigvidd`**, declared once in
  `backend/Core/Telemetry/MetricNames.cs` and registered by the matching `AddMeter`
  call here. The meter name is an unchecked string in exactly two places, like the
  `"AdminOnly"` policy: if they ever differ the counters still record and nothing
  throws, the exporter simply never subscribes. Share the const; never type the
  literal.

  Its instruments are built in `Core/Telemetry/StigviddMetrics.cs` and reached only
  through that type's `Record*` methods — the instruments themselves are private, so
  a call site chooses from the bounded vocabulary in `Core/Telemetry/MetricTags.cs`
  rather than assembling its own dimensions. Attribute vocabulary is the part with
  the 730-day retention and the GDPR argument attached, so it is not left to each
  caller. Today: `stigvidd.trail.favorites.changed`, `stigvidd.review.created`
  (counters) and `stigvidd.review.rating` (histogram).

  Registering the meter does **not** weaken the opt-in guard. A `Meter` is a BCL
  type: creating one registers nothing with OpenTelemetry and starts no thread, so
  `StigviddMetrics` is registered unconditionally in Core while export stays gated on
  `Otlp:Endpoint`. `Tests/IntegrationTests/Telemetry/TelemetryOptInTests.cs` asserts
  both halves — instruments resolvable, `MeterProvider` and `TracerProvider` null.

**Not** emitted, deliberately: spans for `/healthz`, `/readyz`, `/swagger`,
`/openapi` and `OPTIONS` preflights. Health probes alone would otherwise be the
single largest source of spans, forever.

Sampling stays at 100% (`AlwaysOnSampler`). Volume is nowhere near needing
probabilistic sampling, and sampling away spans would destroy the mobile-RUM-to-
server correlation this exists to provide. Volume is controlled by *filtering*
instead. If a head sampler is ever added, it must be `ParentBasedSampler`, or a
sampled mobile request gets dropped server-side.

## Host and container metrics

Everything above is about the application. The `hostmetrics` service — an
OpenTelemetry Collector running the `host_metrics` and `docker_stats` receivers —
is the only thing in the stack that reports on the **machine**: CPU, memory, load,
paging, disk, filesystem and network for the box, plus per-container CPU, memory
and IO from the Docker daemon. It exports OTLP/HTTP to the same
`http://openobserve:5080/api/<org>` the API uses, in-stack and in plaintext.

Config: [`observability/otel-hostmetrics.yaml`](../observability/otel-hostmetrics.yaml),
bind-mounted (not baked into an image), and `scp`'d to the host by the Jenkins deploy
alongside `scripts/`.

**Opt-in, via a compose profile.** The service carries `profiles: [hostmetrics]`, so
with `COMPOSE_PROFILES` unset it does not exist as far as compose is concerned and
`docker compose up -d` skips it. That is what keeps a host with no ingestion token
from running a collector that loops on 401s, and it is why every variable it reads
is `${VAR:-}`-shaped: compose interpolates the **whole file** before selecting
services, so a `${VAR:?}` here would become mandatory for the staging partial stack
too. It has its own OpenObserve identity, `host@` — a sixth producer, holding an
ingestion token like the others.

**CI never starts it.** The Jenkins deploy acts on a hardcoded list of five
services, so — like `db`, `mailserver` and `openobserve` — this is a manual
`docker compose up -d hostmetrics` on the host.

### Attribute names: why this config renames six things

This is the part to read before editing the config, because the failure is a
**release blocker that appears days later on a different machine**.

Metrics streams are kept for 730 days, which is lawful only while they carry no
personal data, and `scripts/observatory-retention.sh` enforces that by tokenising
every metrics field name against a flat identifier set (`device` and `name` are both
in it). The stock receivers emit exactly those names. Measured against
v0.92.2 with collector 0.160.0, the un-renamed config produced **39 flagged fields**
across 26 streams:

| stock name | flattens to | the offending token |
| --- | --- | --- |
| `device` (disk, filesystem, network scrapers) | `device` | `device` |
| `device_major`, `device_minor` (docker blockio) | same | `device` |
| `container.name` | `container_name` | `name` |
| `container.image.name` | `container_image_name` | `name` |
| `host.name` (if `resourcedetection` is added) | `host_name` | `name` |

None of them carry personal data; the tokeniser cannot tell, and widening its
allowlist for `device` would also widen it for the names it exists to catch. So the
config renames instead — `device` → `dev`, `device_major`/`device_minor` →
`dev_major`/`dev_minor`, `container.name` → `container`, `container.image.name` →
`container_image` — and labels the host `hostname` rather than `host.name`, because
`hostname` is a single token and is in no set. With the renames in place the same
run flags **0 fields**, confirmed again on the production host.

The exact stream count varies with the container runtime and the host: 34 on a podman dev
box, **36** on the production host, which additionally exposes `container_memory_file` and
`system_paging_usage`. Do not treat any of these counts as a fixture.

> **A clean run here is not a clean run overall.** A throwaway observatory holding only
> collector data says nothing about the backend's ~90 streams, which trip the same guard on
> names nobody here chose — see *The guard's standing false positives* below.

It also **drops** `container.id`, `container.image.id` and `container.hostname`.
Those are cardinality, not privacy: the first two change on every
`docker compose up -d`, so each recreate would add a new dimension value to a stream
that lives for two years.

Nothing in the repo checks this. `MetricAttributeVocabularyTests` reads the
backend's `MetricTags.Keys` consts and knows nothing about a collector config, so
the only signal is running `scripts/observatory-retention.sh` on the host and
reading the **tail** of its output. See
[notes/metric-attribute-names-trip-the-retention-guard.md](notes/metric-attribute-names-trip-the-retention-guard.md).

### Two more things the config is deliberate about

- **`root_path: /hostfs`, paired with the `/:/hostfs:ro` bind.** Without it the
  filesystem scraper measures the container's image layer — the wrong disk — while
  still reporting entirely plausible numbers. Nothing errors.
- **`collection_interval: 60s` is a floor, not a default.** Every datapoint here
  sits for two years; at 10s this would be six times the disk for no operational
  gain. The filesystem scraper also excludes `overlay`/`tmpfs` and the Docker data
  root, because otherwise each running container contributes mount points that
  become permanent dimensions.

### The guard's standing false positives — backend streams, not the collector

**Pre-dating the host-metrics work, and partly addressed.** On the production host the guard
warned on **114** fields across the backend's streams, every one a false positive of the same
`name` / `user` token rule that catches `trail_name`:

| field | where it comes from | actual value |
| --- | --- | --- |
| ~~`telemetry_sdk_name`~~ **(now allowlisted)** | the OTel SDK's own resource attributes, on **every** stream | `opentelemetry` |
| `db_system_name` | Npgsql instrumentation | `postgresql` |
| `network_protocol_name` | Kestrel instrumentation | `http` |
| `db_client_connection_pool_name` | Npgsql instrumentation | a pool name |
| `dns_question_name` | HttpClient instrumentation | hostnames the API resolves |
| `aspnetcore_user_is_authenticated` | ASP.NET Core authorization | a boolean |

**The advice that works everywhere else does not work here.** `MetricTags` can forbid a name
it owns, and `observability/otel-hostmetrics.yaml` can rename one the collector emits — but
these come from upstream instrumentation packages, so there is nothing of ours to rename.
`MetricAttributeVocabularyTests` is blind to them by construction: it tokenises the `const`
fields of `MetricTags.Keys`, which are exactly `outcome`, `operation` and `list`.

### What was done about it

`telemetry_sdk_name`, `telemetry_sdk_language` and `telemetry_sdk_version` were added to the
script's **`INTERNAL`** set, which is where `service_name` already sat on precisely this
reasoning — "fields every OTLP metric stream carries". They accounted for **82 of the 114**
warnings, because the SDK stamps them on every stream it exports.

This is emphatically *not* the move [the note](notes/metric-attribute-names-trip-the-retention-guard.md)
forbids. The two halves differ in blast radius:

| | effect |
| --- | --- |
| adding `telemetry_sdk_name` to **`INTERNAL`** | exempts exactly that one field name |
| adding `name` to **`IDENT_TOKENS`** | would exempt `nick_name`, `full_name`, `given_name`… |

`INTERNAL` is a list of specific plumbing field names; `IDENT_TOKENS` is a rule. Naming a field
cannot leak into a field nobody has thought of yet. Note also that most of `INTERNAL` does not
trip the token set at all — it describes the whole transport-added group rather than patching
symptoms, which is why all three `telemetry_sdk_*` are listed even though only `_name` fires.

**`MetricAttributeVocabularyTests` needed no change.** It duplicates `IDENT_TOKENS` only, and
checks the `MetricTags.Keys` consts against it directly — it never consults `INTERNAL`. So the
"change it in both places" rule that governs the token set does **not** apply here.

Measured, against a stream carrying both a planted `telemetry_sdk_name` and a planted
`user_id`:

| | `telemetry_sdk_name` | `user_id` |
| --- | --- | --- |
| before | 31 warnings | 31 warnings |
| after | **0** | **31** — still caught |

Quieter, not blinder, which is the only outcome worth having.

### What still warns, and why it was left

**32 warnings across five names remain**, all from instrumentation packages and none personal
data:

`db_client_connection_pool_name` (16), `network_protocol_name` (5, value `http`),
`dns_question_name` (5), `db_system_name` (5, value `postgresql`), and
`aspnetcore_user_is_authenticated` (1, a boolean tripping on `user`).

These were left deliberately. They are semantic-convention **datapoint** attributes chosen by
the instrumentation for their meaning, not transport plumbing, so `INTERNAL` is the wrong home
for them — putting them there would turn a list of "what the transport adds" into a general
amnesty list, which is the slide the note warns about. Thirty-two lines also still read as a
list; a hundred and fourteen did not.

If they are to go, the honest route is the second option: drop them at the exporter with OTel
views in `TelemetryExtensions`, which is a code change with real debugging cost —
`dns_question_name` in particular is the one worth keeping an eye on, since it is the only one
whose cardinality is not bounded by a small enum.

### The disk budget is the open question

36 streams at 60s, kept for **730 days**, is the largest sustained write this stack
has ever pointed at the `observatory` volume, and it is the one number that was
**not** established before shipping: OpenObserve computes stream storage stats on an
hourly background job, so a short verification run reports zeroes rather than a rate.

So measure it on the host, an hour or so after enabling, before assuming the two-year
window is affordable:

```bash
docker system df -v | grep observatory        # volume size, sampled twice an hour apart
```

If it is uncomfortable, raise `collection_interval` or drop scrapers in
`observability/otel-hostmetrics.yaml`. Do **not** shorten the metrics retention to
compensate — the 730-day window is what the whole no-personal-data argument is built
around, and the split is deliberately fail-safe in the other direction.

### Privileges

This service holds two that nothing else in the stack does, both read-only:

| mount | why | risk |
| --- | --- | --- |
| `/:/hostfs:ro` | the only way to measure the host's real filesystems | read access to the host tree from inside a container |
| `/var/run/docker.sock:ro` | the only way to get per-container CPU/memory | **root-equivalent** on the host |

What bounds them: the collector publishes no port, joins only the `public` network,
is reachable from nothing, and runs a config with no receiver that listens. It is a
pure outbound pusher. The docker socket is the price of answering "which container
ate the box", which host-level metrics alone cannot.

## Health endpoints

`/healthz` (liveness) and `/readyz` (readiness, checks the database) are
unauthenticated, and `UseHttpsRedirection` is wrapped in a `UseWhen` that skips
them: the container serves plain HTTP on 8080 behind Caddy and the Docker
healthcheck on `api` probes `127.0.0.1:8080` directly, so a redirect would turn
every probe into a 307.

Note that *mapping order does not do this* — with no explicit `UseRouting()`,
`WebApplication` puts routing at the head of the pipeline and endpoint execution
at the tail, so `UseHttpsRedirection` runs first no matter where the health
endpoints are mapped. It is inert today only because the image configures no
HTTPS port; the `UseWhen` is what keeps the probes working if one is ever added.

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

## Mobile RUM — designed, and deliberately not enabled yet

Sessions, views, taps, native crashes and network resources via
`@openobserve/mobile-react-native`. **Not installed**, blocked on one privacy
question and one verification gap. Both are recorded here so the next person does
not rediscover them the hard way.

### Blocker: resource tracking would leak GPS coordinates

`trackResources: true` is what makes RUM worth having — it captures network calls
*and* injects the W3C `traceparent` that links a mobile resource to the server
span it triggered. But it reports the **full request URL**, and this app sends
positions as query parameters:

```
GET /api/v1/trails/popular?latitude=57.72&longitude=12.94
```

This cannot be scrubbed in the SDK. Verified by reading the shipped code: the URL
is handed to the native layer at `startResource(key, method, url, ...)`, while the
`resourceEventMapper` runs later at stop time and its `RawResource` type has no
`url` field to rewrite — only `context` is mutable.

So enabling it would reintroduce, on the client, exactly the data the backend
takes deliberate care to strip: ASP.NET Core instrumentation records that same
request as `url_query = "?latitude=Redacted&longitude=Redacted"`. It also breaks
the absolute rule above — never log a position — and a *current* location is if
anything more sensitive than a trace point.

Three ways forward, in the order I would consider them:

1. **Move coordinates out of the query string** — a header or a POST body — then
   enable resource tracking fully. Costs an API change coordinated across backend
   and app, but it is the only option that keeps both trace correlation and the
   privacy rule intact.
2. **Ship RUM with `trackResources: false`.** Sessions, views, taps and native
   crashes still work, and there is no leak — but there is no `traceparent`
   injection either, since that lives in the same XHR proxy. End-to-end
   mobile-to-server correlation is lost, which was a headline reason for RUM.
3. **Accept the coordinates in a 7-day stream.** Defensible on paper — it is
   short-retention, pseudonymous data — but it contradicts the rule this document
   sets, and it would make the client's privacy posture weaker than the server's.
   Not recommended without an explicit decision recorded.

### Verification gap

The package is a **native module** (TurboModules codegen, a CocoaPods spec on
`OpenObserveCore`, Maven Central `ai.openobserve:o2-sdk-android-*`), at version
**0.1.1, published 2026-08-06**. It cannot run in Expo Go — not a regression, since
MapLibre and `modules/expo-live-location` already force a custom dev client, but
it does mean **everyone needs a fresh dev-client build**, and an OTA update cannot
ship it.

Whoever picks this up must build **both** platforms before merging, and pin the
exact version (no caret) given how new those native SDKs are.

### Notes for whoever implements it

Verified against the published typings, since the README is stale Datadog copy in
several places (it still links `app.datadoghq.com`, and its `startView` example has
the arguments in the wrong order):

- `firstPartyHosts` is `Array<{ match, propagatorTypes }>`, **not** the `string[]`
  the README shows. `match` is a hostname, while `EXPO_PUBLIC_API_URL` is a full
  base URL — pass the host alone, without scheme, port or path, or matching
  silently fails, which is the most common cause of "correlation isn't working".
- `customEndpoint` is **per feature** (`rumConfiguration`, `logsConfiguration`,
  `traceConfiguration`); there is no top-level one.
- `sessionSampleRate` and `resourceTraceSampleRate` both default to **100** in
  this fork, despite Datadog's docs saying 20 for the latter.
- Use the imperative `O2SdkReactNative.initialize(...)`, not the
  `<OpenObserveProvider>` component: `app/_layout.tsx` returns `null` until fonts
  and the session resolve, so the provider would mount too late.
- Initialise with **`TrackingConsent.PENDING`** and drive it from
  `services/consent.ts`, which already exists for this purpose. The SDK's own
  examples all pass `GRANTED`, which would collect before asking.
- Its `postinstall` rewrites a `react/jsx-runtime` require for React <16.14. At
  React 19 it is a no-op, so this repo's blocked-install-scripts policy is
  harmless here — but check that assumption if React is ever downgraded.

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

And read the tail of its output, not just its exit code: the GDPR guard prints any
identifier-shaped metric field it found. The names that trip it are not the ones you
expect — `trail_name` and `mail_status` both do, while carrying no personal data. See
[notes/metric-attribute-names-trip-the-retention-guard.md](notes/metric-attribute-names-trip-the-retention-guard.md).

The script is idempotent; re-running it is always safe.

### The other 7 days: the host's container logs

Everything above is about **OpenObserve streams**. The host also keeps a second,
completely separate body of logs — Docker's per-container `json-file` files, which
`docker compose logs` reads — and they carry personal data too: `db` runs with
`log_connections=on` behind a publicly published 5432, so every connection attempt
lands there with its source IP.

Both land on 7 days, because §5 of the published privacy policy states one number
for "serverloggar". They get there by different means, and the difference is the
part that catches people out:

| | OpenObserve streams | Host container logs |
| --- | --- | --- |
| holds | logs, traces, RUM, metrics | stdout/stderr of the 8 compose services |
| bounded by | `ZO_COMPACT_DATA_RETENTION_DAYS` — genuinely **time**-based | `max-size`/`max-file` on the `x-logging` anchor — **size** only |
| aged out by | OpenObserve's own compactor, continuously | `scripts/container-log-retention.sh`, from a daily systemd timer |
| set by | `OBSERVATORY_RETENTION_DAYS` | `CONTAINER_LOG_RETENTION_DAYS` |
| fails by | a new stream inheriting the global (see above) | the timer never being installed — **silent**, see below |

> **`json-file` has no time-based retention.** `max-size` and `max-file` bound
> *disk*, not *age*: under any size cap a quiet service keeps its oldest line
> forever, and the driver's default is no rotation at all. Nothing in
> `docker-compose.yml` can express "7 days", so the compose caps are only half the
> promise and `scripts/container-log-retention.sh` is the other half. See
> [notes/json-file-has-no-time-retention.md](notes/json-file-has-no-time-retention.md).

The asymmetry with `observatory-retention.sh` is worth stating plainly: that one is
a **one-off** re-applied after instrumentation changes, this one **must recur**. A
host where the timer was never installed looks completely healthy — the stack runs,
logs are readable, disk is capped — while the published policy is false. Part 1
step 9 of [DEPLOYMENT.md](../DEPLOYMENT.md) installs it, and the check is
`systemctl list-timers stigvidd-log-retention.timer`.

The script prunes rotated segments by mtime and rewrites the active segment in
place, keeping the file's inode because Docker holds it open. That rewrite is
logrotate's `copytruncate` trade: a line appended during the rewrite is lost, at
most once a day per container. Retaining personal data past its stated window is
the worse of the two.

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
extracted in minutes, and the admin web's ingestion token is more exposed still —
served in a JS bundle, readable without unpacking anything. There is no way to make
direct-from-client telemetry not have this property; the question is only how much a
stolen credential buys, and that is entirely decided by item 1 below.

1. **The ingestion token is the only privilege boundary there is.** The open
   question this section used to carry — "verify what a `Member` can actually
   see" — has been answered, and the answer is *everything*: **OpenObserve OSS
   has no RBAC at all**. `Member`, `Editor` and `Viewer` are rejected outright
   ("Custom roles not allowed"), `service_account` is accepted and silently
   stored as `admin`, and every account is a full admin. Enterprise-only, all of
   it — including Service Accounts.

   What *is* enforced is the split between an account's login **password** and
   its per-user, per-organisation **passcode** (the "ingestion token" on the
   Ingestion page). Measured against v0.92.2, one and the same account:

   | credential | `_json` / OTLP ingest | `/_search` | `/users` |
   | --- | --- | --- | --- |
   | ingestion token | 200 | **401** | **401** |
   | login password | 200 | 200 — reads every stream | 200 — creates admin users |

   So the rule is mechanical: **anything that ships to a client carries an
   ingestion token, never a password.** A password in a public bundle is not a
   scoped ingest credential, it is full control of the observatory — which is
   what the app shipped before this was measured.

   **Six identities**, one per producer so that a token extracted from a public
   bundle is not also another producer's, and so one can be rotated alone:
   root (first boot only, and unrotatable), `api@` (server-side), `app@` and
   `web@` (both public, ingest-only), `host@` (server-side, the host-metrics
   collector, and optional — it exists only where that profile is enabled), and
   `ops@` (a password, because stream management is not an ingest route and a
   passcode gets a 401 there).

   Rotation is asymmetric and worth remembering: the API takes a restart, while
   `app@` and `web@` are compiled in and take a rebuild and a release.
   See [notes/openobserve-oss-has-no-rbac.md](notes/openobserve-oss-has-no-rbac.md).
2. **Retention as blast-radius cap.** An abuser cannot fill the disk forever, only
   up to `retention × their rate`. Note that garbage written into a *metrics*
   stream would sit for two years — if the token is ever abused, look for junk
   metric streams specifically and delete them rather than waiting for retention — but note
   that this is **one-way**: a deleted stream is never recreated by later ingest, and the
   producer still sending it is told nothing
   ([notes/deleting-an-openobserve-stream-stops-it-being-recreated.md](notes/deleting-an-openobserve-stream-stops-it-being-recreated.md)).
3. **The host-metrics collector's two host privileges** — a read-only bind of `/`
   and a read-only Docker socket — are the largest privileges granted anywhere in
   this stack, and they are granted to a container that listens on nothing. It runs
   only where the `hostmetrics` compose profile is enabled, so most of the reason
   it is defensible is that it is absent by default. See **Privileges** above.
4. **`request_body max_size 10MB`** in the Caddyfile caps a single request.
5. **`ZO_INGEST_ALLOWED_UPTO` / `_IN_FUTURE`** bound timestamp spoofing, so nobody
   can plant events years out to evade retention or pollute dashboards.
6. **No Caddy access log on the ingest paths** — beyond the disk cost,
   access-logging a write endpoint an attacker controls is a log-injection surface.
7. **Rate limiting is the honest gap.** Caddy OSS has no built-in `rate_limit`; it
   is the third-party `mholt/caddy-ratelimit`, which means converting
   `proxy/Dockerfile` to an `xcaddy` build stage — a Go build in a currently-instant
   image build, and a third-party module in the TLS-terminating path. Not worth it
   on day one. The trigger should be evidence: anomalous volume growth or garbage
   streams.

## Local development

Telemetry is off unless configured, so nothing is needed by default. To see your
own traces and logs locally, run the same image production uses — see the
**Telemetry** section of the root `README.md`.
