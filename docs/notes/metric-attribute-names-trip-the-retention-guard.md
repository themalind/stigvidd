# A metric attribute called `trail_name` is flagged as personal data, and so is `mail_status`

`scripts/observatory-retention.sh` ends with a GDPR guard: metrics streams are kept for 730 days,
which is only lawful while they carry no personal data, so it fetches every metrics stream schema
and warns on identifier-shaped field names. A warning there is a release blocker.

It decides by **tokenising**, and the tokeniser has no idea what your domain means. Each schema
field name is lowercased, split on `[^a-z0-9]+`, and every token is looked up in one flat set:

```
user userid uid sub subject session sessionid email mail ip clientip remoteaddr
device deviceid token lat latitude lon lng longitude coord coords coordinate
coordinates geo phone name
```

`name` is in that set. `mail` is in that set. `subject` is in that set. So the guard fires on
names that contain no personal data whatsoever:

| attribute key | tokens | why it warns |
| --- | --- | --- |
| `trail_name`, `area_name`, `template_name` | …, `name` | a trail is not a person; the tokeniser cannot tell |
| `mail_status` | `mail`, `status` | it means "did the mail send", not "an email address" |
| `subject` | `subject` | an email subject line, not a Keycloak subject id — no exception for meaning |
| `import_session_status` | `import`, `session`, `status` | an import session, not a user session |
| `user_agent` | `user`, `agent` | |

Two that pass and look like they should not: `hostname` is a single token and is in no set, and
`service_name` is in the script's own `INTERNAL` allowlist of fields every OTLP stream carries,
so it is never flagged despite ending in `name`.

## The same trap, from an OpenTelemetry Collector

The tokeniser does not care who produced the field, and the **stock** attribute names
of the `host_metrics` and `docker_stats` receivers are worse offenders than anything
hand-written here. Measured with collector 0.160.0 against OpenObserve v0.92.2, an
un-renamed config produced **39 flagged fields across 26 streams** — with the renames
in `observability/otel-hostmetrics.yaml`, **0**:

| stock attribute | flattens to | token that fires |
| --- | --- | --- |
| `device` — disk, filesystem, network, paging scrapers | `device` | `device` |
| `device_major`, `device_minor` — docker blockio | same | `device` |
| `container.name` | `container_name` | `name` |
| `container.image.name` | `container_image_name` | `name` |
| `host.name` — what `resourcedetection` adds | `host_name` | `name` |

`device` is the surprising one, because it reads as hardware rather than identity;
it is in `IDENT_TOKENS` for `deviceid`'s sake. The renames chosen, all in the
collector's `resource` and `attributes` processors: `dev`, `dev_major`, `dev_minor`,
`container`, `container_image`, and a literal `hostname` resource attribute instead
of `host.name` — `hostname` being one token and in no set, exactly as recorded above.

Worth knowing: `container_id` **passes** (`container`, `id` — neither is in the set),
so the guard is no help at all against the thing that actually threatens a two-year
stream there, which is cardinality. That config drops it anyway.

## The case the "rename it" advice cannot solve

Renaming works only for a name **we own**. Measured on the production host, the guard warns on
~120 fields that come from the OpenTelemetry SDK and its instrumentation packages, where there
is nothing of ours to rename:

`telemetry_sdk_name` (on every stream the SDK exports), `db_system_name` (`postgresql`),
`network_protocol_name` (`http`), `db_client_connection_pool_name`, `dns_question_name`, and
`aspnetcore_user_is_authenticated` — which trips on `user` while holding a boolean.

`MetricAttributeVocabularyTests` cannot see any of them: it tokenises the `const` fields of
`MetricTags.Keys`, which are exactly `outcome`, `operation` and `list`. So the build stays
green and the host warns forever.

### The fix is `INTERNAL`, and that is a different thing from `IDENT_TOKENS`

`telemetry_sdk_name`, `telemetry_sdk_language` and `telemetry_sdk_version` are now in the
script's **`INTERNAL`** set, which is where `service_name` already sat for the same stated
reason — a field every OTLP metric stream carries. They were **82 of the 114** warnings,
because the SDK stamps them on every stream.

The distinction that makes this safe, and that the "do not widen the guard" rule above is
really about:

| | blast radius |
| --- | --- |
| a name in **`INTERNAL`** | exactly that one field |
| a token in **`IDENT_TOKENS`** | every field containing it — `nick_name`, `given_name`, … |

One is a list, the other is a rule. Most of `INTERNAL` does not even trip the token set; it
describes the transport-added group rather than patching symptoms, which is why all three
`telemetry_sdk_*` are listed although only `_name` fires.

**This half is NOT duplicated in the test.** `MetricAttributeVocabularyTests` copies
`IDENT_TOKENS` and checks `MetricTags.Keys` against it directly; it never reads `INTERNAL`. So
the "change it in both places" rule stated below applies to the token set only — verified by
reading the test, which has no `INTERNAL` of its own.

Measured on a stream carrying a planted `telemetry_sdk_name` and a planted `user_id`: before,
31 warnings each; after, **0** and **31**. Quieter, not blinder.

**32 warnings remain** and were left deliberately — `db_client_connection_pool_name` (16),
`network_protocol_name`, `dns_question_name`, `db_system_name` (5 each) and
`aspnetcore_user_is_authenticated` (1). Those are semantic-convention *datapoint* attributes
chosen for their meaning, not transport plumbing; putting them in `INTERNAL` would turn a list
of what the transport adds into a general amnesty list, which is exactly the slide this note
warns about. See [docs/observability.md](../observability.md).

### Editing the script at all: mind the apostrophe

The guard is Python embedded in a **single-quoted** `python3 -c '...'` block, so one apostrophe
anywhere inside it — a comment included — closes the quote. Writing "the SDK's own attributes"
in a comment there produced a bash syntax error reported at the closing brace of the *next*
dict, pointing nowhere near the cause. Nothing in GitHub CI or Jenkins runs this script, so
`bash -n scripts/observatory-retention.sh` after editing is the only thing that catches it.

## Why the obvious fix is the wrong one

The reflex on seeing the warning is to argue the case — a trail name really is not personal data,
so surely the guard is over-eager and the fix is to widen its allowlist. Don't. The guard is
deliberately a **name**-level check rather than a content-level one, because it is the only thing
standing between a careless dimension and a field that sits in a stream for two years. Widening it
for `trail_name` also widens it for `nick_name`.

Rename instead, or carry no dimension at all:

- `mail_status` → `delivery_status`
- `template_name` → `template_key`
- a trail or area dimension → **nothing**. Which trail a given person favourited is a location
  inference about that person, and it is unbounded cardinality besides.

## It is checked at build time now, not just on the host

The script runs **on the host, after deploy**, and prints a warning into output nobody reads until
release — by which time the stream exists and the two-year clock has started.
`backend/Tests/UnitTests/Telemetry/MetricAttributeVocabularyTests.cs` reproduces the same
tokenisation over the `const` fields of `Core/Telemetry/MetricTags.Keys` and fails the build
instead. Its token set is copied verbatim from the script and the two have nothing but a comment
tying them together, so **a change to `IDENT_TOKENS` has to be made in both places**.

Measured: planting `UserId = "user_id"` turns it red naming the token `user`; planting
`TrailName = "trail_name"` and `MailStatus = "mail_status"` turns it red on both, which is the
case a reviewer would otherwise wave through.

## Two more things about the guard that are easy to assume wrong

- It lists `?type=metrics` only. A stream created by the clients' bulk `_json` ingest is not a
  metrics stream, so it is neither raised to 730 days nor scanned — which is the desired outcome
  for 7-day event streams, but means the guard is **not** a repo-wide personal-data check.
- A metrics stream is created on **first ingest** and inherits the 7-day global retention until
  the script is re-run. So adding any instrument obliges re-running it on the host after deploy,
  and reading the tail of its output.

And a third blind spot on top of the two above: a **collector** config is checked by
nothing at all. `MetricAttributeVocabularyTests` reads the backend's `MetricTags.Keys`
consts; it cannot see `observability/otel-hostmetrics.yaml`. The only signal there is
running the script itself and reading the tail.

Related: [[openobserve-oss-has-no-rbac]] for why the script needs an account password rather than
an ingestion token, and [docs/observability.md](../observability.md) for the retention split this
all serves.
