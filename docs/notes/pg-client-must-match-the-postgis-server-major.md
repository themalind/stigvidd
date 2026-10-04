<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# The api image's postgresql-client major must track the postgis/postgis tag, or admin export stops working

The admin export (`GET /api/v1/admin/export`) shells out to `pg_dump`, and the import uses
`pg_restore` and `psql`. These come from the `postgresql-client-N` package that
[backend/Dockerfile](../../backend/Dockerfile) installs from the PGDG repository.

`pg_dump` refuses to dump a server **newer** than itself:

```text
pg_dump: error: aborting because of server version mismatch
```

Commit 276a751e moved `db` in [docker-compose.yml](../../docker-compose.yml) to
`postgis/postgis:17-3.5` and left the Dockerfile on `postgresql-client-16`. From then on, every
export failed in production. Nothing caught it:

- the tests run on SQLite and never call `pg_dump`;
- the only export tests are the authorization ones.

The fix moved the Dockerfile to `postgresql-client-17`. **Bump the two together.** An older
client against a newer server breaks, while a newer client dumps an older server fine. So when
in doubt, the client may lead but never lag.

`verify-in-docker` is the only check that exercises the real path. Use it after touching either
line.

Related: [[postgis-image-schemas-break-a-dump-restore]].
