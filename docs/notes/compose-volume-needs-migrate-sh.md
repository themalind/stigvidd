# A new named volume in docker-compose.yml is a change to scripts/migrate.sh as well

[scripts/migrate.sh](../../scripts/migrate.sh) is what moves a deployment between hosts, and
the set of volumes it carries is a **hand-maintained list**:

```sh
VOLUMES=(pgdata media maildata mailstate trail_imports)
```

Nothing enforces that this list matches `docker-compose.yml`, and the failure mode of a
mismatch is the bad kind: `mount_args()` only warns about volumes it was *told* to look for,
so an **omitted** volume produces no output at all. The backup succeeds, the migration reports
success, and the loss surfaces later on the target when something reads data that was never
carried over.

No CI job runs this script — GitHub Actions does not, and the Jenkinsfile does not — so there
is no signal here but reading it.

## The worked example (fixed)

`trail_imports` was added to compose for the trail-import feature, with its own comment
explaining that it is stateful: *"a session is re-analysed from the file it was created from,
days after the upload."* `migrate.sh` was not updated, so for a while a host migration
silently dropped every uploaded import source while reporting success.

Verified both ways with a throwaway project prefix, five marker-bearing volumes, and no real
stack involved:

| | trail_imports entries in the tarball |
| --- | --- |
| the old four-volume list | **0** — the bug, reproduced |
| the current list | 2, and the marker survives a full backup -> restore onto a fresh prefix |

## Listing a volume is safe; omitting one is not

The asymmetry is worth knowing before hesitating over the edit:

- A volume this host **does not have yet** is skipped with a warning and a zero exit —
  measured, by deleting the volume and re-running `backup`. That is what makes the list safe
  to extend for hosts predating a feature (`mail*`, `trail_imports`).
- Restoring an **older tarball** with the newer script is also fine: the volume is created and
  left empty, no error.

So the edit is backward-compatible in both directions, and the only way to get it wrong is to
forget it.

Related: [[agent-harness-hooks]].
