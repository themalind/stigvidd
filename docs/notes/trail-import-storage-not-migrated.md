# scripts/migrate.sh does not carry the trail_imports volume

`docker-compose.yml` gives the API a volume for uploaded trail-import source files, and its
own comment says why they are stateful:

```yaml
      # Uploaded trail-import source files. On a volume because a session is
      # re-analysed from the file it was created from, days after the upload.
      TrailImport__StoragePath: /app/trail-imports
    volumes:
      - trail_imports:/app/trail-imports
```

[scripts/migrate.sh](../../scripts/migrate.sh) — the script that moves a deployment between
hosts — still enumerates four:

```sh
VOLUMES=(pgdata media maildata mailstate)
```

So a host migration copies the database, the media and the mail state, and **silently leaves
the uploaded import files behind**. The failure is not at migration time: it is later, when
an import session that is still awaiting review is re-analysed on the new host and its
source file is gone. `mount_args()` only warns about volumes that are *listed and missing*,
so an unlisted one produces no output at all, and the migration reports success.

Adding `trail_imports` to that array is safe on hosts that predate the volume — `mount_args`
warns and skips a volume that does not exist — but it is a deployment-behaviour change in
the trail-import feature's own area, so it is filed here rather than changed in passing.

The general shape is worth remembering: **a new named volume in `docker-compose.yml` is a
change to `scripts/migrate.sh` as well**, and nothing enforces the pair. Neither GitHub CI
nor Jenkins runs that script at all — see the `verify-in-docker` skill for what covers the
stack and what does not.

Related: [[agent-harness-hooks]].
