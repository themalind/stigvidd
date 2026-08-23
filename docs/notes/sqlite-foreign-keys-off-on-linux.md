# SQLite enforces no foreign key unless the pragma is on, and Linux and Windows disagree

SQLite ignores every `FOREIGN KEY` clause — `ON DELETE CASCADE` included — unless
`PRAGMA foreign_keys` is on. It is a **per-connection** switch, off in a stock build, and the
two SQLite builds the integration suite binds do not agree on the default:

| | build | `PRAGMA foreign_keys` default |
| --- | --- | --- |
| Windows | bundled `e_sqlite3` (SQLitePCLRaw) | **1** — compiled `SQLITE_DEFAULT_FOREIGN_KEYS=1` |
| Linux | system `libsqlite3` via `SQLite3Provider_sqlite3` | **0** |

Which provider gets bound, and why it has to differ, is
[spatialite-per-os](spatialite-per-os.md).

So this is another trap that **fails on one platform and passes on the other**, like
[srid-4326](srid-4326.md). Measured on Gentoo, libsqlite3 3.53.3: the pragma read back `0`
while the schema `EnsureCreated()` produced carried the clause in full —

```
CONSTRAINT "FK_TrailImportProposals_TrailImportSessions_SessionId"
  FOREIGN KEY ("SessionId") REFERENCES "TrailImportSessions" ("Id") ON DELETE CASCADE
```

— so EF emitted the cascade correctly and SQLite simply declined to act on it. Do not go
looking for a missing `OnDelete` in the model; read the pragma first.

## The fix, in WebApplicationFactory

[`WebApplicationFactory.cs`](../../backend/Tests/IntegrationTests/WebApplicationFactory.cs)
now asks for it explicitly, which is a no-op on Windows and the whole difference on Linux:

```csharp
_connection = new SqliteConnection("DataSource=:memory:;Foreign Keys=True");
```

Microsoft.Data.Sqlite issues the pragma on `Open()`. It has to be in the connection string
(or run before any transaction begins) because `PRAGMA foreign_keys` is a **silent no-op
inside a transaction** — setting it from inside a test would appear to work and change
nothing.

Turning enforcement on suite-wide was the real risk here, not the one-line change. Measured
after: **1364 of 1364 backend tests pass**, so no seed or test was depending on the FKs being
inert.

## Why it surfaced on a delete that looked ordinary

`TrailImportRepository.DeleteSessionAsync` deletes with **`ExecuteDeleteAsync()`**, which
issues a server-side `DELETE` and **bypasses EF's change tracker** — so EF's own cascade
fix-up never runs and the *database* has to do the cascading. That is the shape to watch:
`ExecuteDelete`/`ExecuteUpdate` on a principal makes `OnDelete(Cascade)` a database
obligation, and under an unenforced FK the children just survive.

Proven to bite (the [prove-it-bites](../../.claude/skills/prove-it-bites/SKILL.md) round):
switching the relationship to `DeleteBehavior.ClientCascade` — which emits no `ON DELETE`
clause and cascades in the tracker only — turns
`DeleteSessionAsync_ShouldTakeTheProposalsWithItAndLeaveTheTrailsAlone` red again, now with
the FK refusing the parent delete outright (`result.IsSuccess` is `False`). Before the pragma
fix that same mutation would have been indistinguishable from a pass on that assertion.

## History

This was carried as a known-failing test on `develop` for a while (measured at `0e1a99e`:
1358 tests, 2 failures), with the cause listed as one of two unconfirmed candidates — the
pragma, or `EnsureCreated()` not emitting the clause. It is the pragma; the schema was always
correct. Fixed 2026-08-23.

Related: [[spatialite-per-os]], [[srid-4326]], [[dotnet-test-connection-string]].
