# Docker's `json-file` driver has no time-based retention, so `max-size` never means "7 days"

`web/public/privacy-policy/index.html` §5 publishes a number — "Serverloggar: 7 dagar" /
"Server logs: 7 days", in both languages — and container logs on the deploy host are
personal data: `db` runs with `log_connections=on` behind a publicly published 5432, so
every connection attempt is written to its log with the source IP.

The obvious way to honour that is a `logging:` block in `docker-compose.yml`. It does not
honour it. The `json-file` driver (and `local`) accept **only** `max-size` and `max-file`,
which bound **disk**, not **age**:

```yaml
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"     # rotate at 10 MB
    max-file: "3"       # keep 3 segments
```

A service that writes 10 MB a day rotates out of the window in three days. A quiet service —
`media`, `mailserver`, `web` on a pre-launch site — writes a few hundred bytes a week and
keeps its oldest line **forever** under exactly the same config. The size cap is a disk
guarantee dressed up as a retention guarantee, and it is the quiet services that hold the
oldest data.

Worse, the driver's *default* is no rotation at all: with no `logging:` key, the file grows
without limit for the life of the container. That was the state here until 2026-08-30.

## What actually holds the 7 days

Two halves, and only the second one is time-based:

| | mechanism | bounds |
| --- | --- | --- |
| `x-logging` anchor in [docker-compose.yml](../../docker-compose.yml) | rotation caps on all 8 services | disk |
| [scripts/container-log-retention.sh](../../scripts/container-log-retention.sh) | daily systemd timer, `DEPLOYMENT.md` Part 1 step 9 | **age** |

The script deletes rotated segments by mtime and rewrites the active segment keeping only
entries inside the window. It writes back through the **same inode** (`cat tmp > "$LogPath"`,
never `mv`): Docker holds that file open `O_APPEND`, so a rename leaves the daemon writing
into an unlinked inode and the log appears to stop dead until the container is recreated.
That rewrite is logrotate's `copytruncate` trade — a line appended mid-rewrite is lost, at
most once a day per container.

## Two ways this fails silently

1. **The timer is never installed.** Nothing reports it. The stack runs, `docker compose
   logs` works, disk stays capped by the size limits — and no log line is ever deleted, while
   a published legal document says they are. Unlike `scripts/observatory-retention.sh`, which
   is a one-off re-applied after instrumentation changes, this one **must recur**. Check with
   `systemctl list-timers stigvidd-log-retention.timer`.
2. **Log options are fixed at container *create* time.** A container that predates the
   anchor keeps its unbounded config through any number of `docker compose restart`s; only
   `up -d`, which recreates it, applies the caps. `docker inspect --format
   '{{.HostConfig.LogConfig}}' $(docker compose ps -q api)` is the check.

Note this is a *different* 7 days from the OpenObserve one. `OBSERVATORY_RETENTION_DAYS`
(`ZO_COMPACT_DATA_RETENTION_DAYS`) is genuinely time-based and governs telemetry streams;
`CONTAINER_LOG_RETENTION_DAYS` governs the host's container log files. They match only
because §5 states one number. Raising either without editing §5 in **both** languages makes a
published legal document false — see [docs/observability.md](../observability.md) and
[[licence-is-per-area-not-repo-wide]] for the neighbouring "the repo is not uniform" trap.
