# Deleting an OpenObserve stream does not reset it — later ingest never recreates it, and the producer reports success

A metrics stream is created on **first ingest**, which reads as "the stream is just a view of
whatever arrives". It is not. Once a stream has been deleted through
`DELETE /api/{org}/streams/{name}?type=metrics`, that name stays gone for the life of the
instance, and the producer still sending it is told nothing.

Measured against `public.ecr.aws/zinclabs/openobserve:v0.92.2`, with an OpenTelemetry
Collector pushing 34 host-metric streams on a 60s interval:

| | |
| --- | --- |
| before | 34 streams |
| `DELETE .../streams/system_memory_usage?type=metrics` | `{"code":200,"message":"stream deleted"}` |
| after 150s — 2.5 scrape intervals | **33 streams**; `system_memory_usage` did not come back |
| the other 33 | still ingesting normally |
| collector log over the same window | **completely silent** — no error, no warning, no retry |

So the loss is one-way and invisible from the producing side. Nothing distinguishes "this
metric is not being collected" from "this metric was deleted once and can never come back",
and the only place the difference is visible is the stream list.

## Why this reads as something else entirely

The reflex when a stream is missing is to suspect the producer — a receiver that stopped, a
credential that expired, an exporter pointed at the wrong path. All of those produce log
lines. This produces none, so the evidence points at the one place that is innocent.

It is worst during **verification**, where deleting streams to get a clean run is the obvious
move. Do that and the next run comes back with *zero* streams and a collector that looks
perfectly healthy — which is indistinguishable from "my config change broke ingest", and
sends you rewriting a config that was already correct. That is exactly how it was found.

To re-run an ingest experiment from a clean slate, **recreate the instance**, do not delete
the streams:

```sh
docker rm -f <container> && docker volume rm <data-volume>
```

## The related timing trap, since the two compound

A collector scrapes for the first time one full `collection_interval` **after** start, not at
start. At the 60s interval `observability/otel-hostmetrics.yaml` uses, an empty stream list
twenty seconds in is normal and means nothing. Combined with the above, a verification run
can look broken for two entirely different reasons at once, neither of which logs anything.

Wait out at least one interval before concluding anything from an empty stream list.

## Operational consequence

`scripts/observatory-retention.sh` raises every *existing* metrics stream to 730 days and
explicitly cannot pre-create one. Pair that with this note and deleting a metrics stream on
the production host is close to irreversible: the name does not return on its own, so the
history is gone and so is the stream the retention override was applied to.

The advice in [docs/observability.md](../observability.md) to delete junk metric streams if an
ingestion token is ever abused is still right — but it is a **one-way** action, and it must
target only names nothing legitimate is still producing.

Related: [[openobserve-oss-has-no-rbac]] for which credential can delete a stream at all (a
passcode gets a 401 on `/streams`; this needs an account password), and
[[metric-attribute-names-trip-the-retention-guard]] for the other half of what a metrics
stream's lifetime depends on.
