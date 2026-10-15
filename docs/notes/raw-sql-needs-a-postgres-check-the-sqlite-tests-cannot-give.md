# Raw SQL passes on the SQLite test provider and still needs one run against real PostgreSQL

`Core/Repositories/HikeShareInsert.cs` writes hike shares with a hand-built
`INSERT ... ON CONFLICT DO NOTHING`, so a concurrent share of the same recipient keeps the
existing row instead of failing the batch. Every automated test of it runs on SQLite:
[HikeShareRepositoryIntegrationTests.cs](../../backend/Tests/IntegrationTests/HikeSharesController/HikeShareRepositoryIntegrationTests.cs)
uses the in-memory connection string like the rest of the suite. SQLite accepts the same
`ON CONFLICT` syntax, so green there says nothing about quoting, the `dbo` schema, parameter
types or `timestamp with time zone` on the production database.

## How it was checked (2026-10-12)

A throwaway check, not in the repo:

1. `docker run` a `postgis/postgis:17-3.5` container on a spare port (not the compose one).
2. A file-based `dotnet run` app with `#:property PublishAot=false`, referencing
   Infrastructure and Core. Point its connection string at the container, run the migrations,
   then call `HikeShareRepository.ShareHikesAsync` with a batch where one row already exists.
3. Check that the existing row is unchanged and the others were inserted.

Rerun it after changing `HikeShareInsert`, or when adding another raw-SQL write. The
resharing path once had its own copy of the insert, which was never run against PostgreSQL;
since 2026-10-15 both paths go through `ShareHikesAsync` via `HikeShareDistributor`.

## The NULL that looks like it should be a parameter

`SharedById` is null for some rows. Passing `DBNull.Value` as a raw parameter fails: EF has
no store type mapping for a bare `DBNull`. The helper writes `NULL` as a literal instead and
only parameterises real values. That looks like a SQL-injection smell and is not one: no user
text ever reaches the literal.

Related: [[srid-4326]] (another case where the SQLite tests cannot see a PostgreSQL-only fact).
