<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# EF cannot `Concat`, `OrderBy` or aggregate through a constructor projection, and EF InMemory hides all three

The media library is a union of three sources (`TrailImages`, `FacilityImages`, and
`Trail.TrailSymbolImage`), so the obvious way to page and filter it is to project each source
into one shared record and then work on that:

```csharp
context.TrailImages.Select(ti => new MediaItemProjection(...))   // one shape for all three
    .Where(predicate)                                            // one shared filter
    .Concat(facilities).OrderByDescending(m => m.CreatedAt).Skip(n).Take(m)
```

**Three of those four operators do not translate**, and they fail one at a time, each behind
the previous one's fix. Measured on EF Core 10 against SQLite, building
`MediaRepository.GetMediaPagedAsync`:

| operator after the projection | result |
| --- | --- |
| `Concat` | `Unable to translate set operation after client projection has been applied.` |
| `Sum(m => m.SizeBytes)` | `The LINQ expression ... .Sum()' could not be translated` |
| `Select(m => m.SizeBytes).Sum()` | same — EF does **not** simplify `new Record(...).SizeBytes` to the column |
| `OrderByDescending(m => m.CreatedAt)` | `could not be translated` |
| `Where(m => m.Width >= 800)` | **translates** |
| `Where(m => m.ImageUrl.ToLower().EndsWith(x))` | `could not be translated` |

So `Where` over a projection translates for a plain comparison and **not** for a method chain,
which is the most misleading row in the table: a dimension filter works, and the format filter
beside it does not.

## Why none of this shows up until an integration test runs

`Tests/UnitTests` is EF InMemory (`TestBase.cs`), which is LINQ-to-objects — it evaluates all
six forms happily. The repository catches its own exceptions and returns
`RepositoryResult.Error()`, so the only symptom is a **500 with an empty `Value`**, and the
message lives in a log line the test never prints. Thirteen unit tests over the predicate were
green while the endpoint could not serve a single filtered request.

The same split as [[executedelete-cannot-be-unit-tested-here]]: InMemory proves the *rule*,
and only the SQLite integration suite proves the *query*.

## What works instead

Filter the **entity**, project afterwards, and do the union, the ordering and the paging in
memory:

- [`IMediaImage`](../../backend/Infrastructure/Data/Entities/IMediaImage.cs) — the members
  `TrailImage` and `FacilityImage` share. A generic
  `Expression<Func<T, bool>> Matches<T>(MediaFilter) where T : IMediaImage` **does** translate;
  EF resolves the interface member to the mapped column by name. That keeps one testable
  predicate without a projection.
- Anything the interface cannot carry (an owner identifier, which lives behind a navigation)
  is a separate `Where` per source.
- The three `ToListAsync` results are concatenated, ordered and paged in C#. The bound is the
  number of rows *matching the filter* — still strictly less than the whole library this
  endpoint returned on every call before.

If a later change pushes ordering back into SQL, the merge needs the database's order and the
in-memory order to agree, and the tiebreak must be the **`int Id`, never the `Identifier`**: a
string is compared under the Postgres collation on one side and `StringComparer.Ordinal` on
the other, and the two disagree on a GUID's hyphens under `en_US.utf8` — which would misplace
rows at page boundaries in production only.

## Two neighbours found the same way

- **`format=jpeg` matched nothing**, because `MediaItemResponse` reports a `.jpg` file as
  `"jpeg"` while the filter built the single suffix `".jpeg"`. A format a caller reads back
  must be one it can filter on, so `SuffixesFor` returns **both** spellings.
- **Adding `[ProducesResponseType(400)]` to an action deleted its 200 from the OpenAPI
  document**, and with it `MediaItemResponse` and `MediaLibraryPageResponse` — orval then
  generated query params for an endpoint with no response type. Declaring any
  `ProducesResponseType` stops ApiExplorer inferring the success one, so the 200 has to be
  declared too.

## Measured again, and what pushing it into SQL would cost

The failure is reproducible on demand and is the sharpest demonstration in the repo of what
the unit suite cannot see. Moving one `OrderByDescending(m => m.CreatedAt)` from the entity
query onto `source.Query` (the projected one) and running both suites:

| suite | result |
| --- | --- |
| `Tests/UnitTests` (EF InMemory) | **1491 passed, 0 failed** |
| `Tests/IntegrationTests` (SQLite) | **30 failed**, every one a 500 with an empty body |

The rewrite the last section gestures at IS possible — the note only ever proved that those
operators fail **after** the projection, and all of them translate on the entity query before
`.Select(...)`. A k-way merge reproduces the global order exactly, because `OwnerType` is
constant within a source, so the global comparator restricted to one source collapses to
`(sortKey, SourceId)` — the standard merge precondition. It was **declined** anyway:

- Per source it is page + count + sum, so **3 round trips become 8**. Below roughly 2000 rows
  that is a net latency loss; the win is bounded memory, not speed.
- Two prerequisites, neither obvious. `MediaLibraryQuery.MaxPage` has to exist first or each
  source does `Take(skip + pageSize)` on an unbounded page and `LIMIT` goes negative. And
  **Postgres `SUM(bigint)` returns `numeric`**, which Npgsql casts back — SQLite returns
  INTEGER and will stay green either way, so that one is another `ToUtc`-shaped trap.
- `largest`/`widest` order the symbol source by `t.Id`, never by the projected literal `0`:
  a bare integer in a Postgres `ORDER BY` is an ordinal column reference, and `ORDER BY 0`
  is an error.

What was done instead is the bounded half: `GetMatchingAsync` applies its cap as
`OrderBy(e => e.Id).Take(limit)` on the **entity**, so the 5000-image refusal bounds the read
it guards rather than firing after the whole set is already materialised.

## Two more the same shape

- **A filter validated case-insensitively must be consumed canonically.**
  `MediaLibraryQueryValidator` accepted `?ownerType=trail` (`OrdinalIgnoreCase`) while
  `Sources` branched on `is null or "Trail"`. Measured: 200 OK, `TotalCount` 0, on a library
  holding 9 trail images. `Sort` and `Format` were both lower-cased before use and `OwnerType`
  was not — the asymmetry is invisible in review because all three read the same.
- **Unbounded `Page` plus `int` arithmetic serves page 1 under any page number.**
  `(page - 1) * pageSize` at `?page=20000000&pageSize=200` wraps negative, `Enumerable.Skip`
  clamps a negative to zero, and `page * pageSize < matched.Count` wraps too, so `hasMore`
  is true forever. A validator bound plus `long` arithmetic; the test asserts a 400.

Related: [[integration-tests-inherit-api-config]] for the other thing the integration suite
proves that no unit test can.
