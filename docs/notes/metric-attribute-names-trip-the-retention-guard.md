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

Related: [[openobserve-oss-has-no-rbac]] for why the script needs an account password rather than
an ingestion token, and [docs/observability.md](../observability.md) for the retention split this
all serves.
