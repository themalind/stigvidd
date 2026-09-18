<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# A repository method using `ExecuteDeleteAsync` cannot be unit-tested in this repo, because `Tests/UnitTests` is EF InMemory

`ExecuteDeleteAsync` and `ExecuteUpdateAsync` are relational-only. They throw on the **EF
InMemory** provider, and [`Tests/UnitTests/TestBase.cs`](../../backend/Tests/UnitTests/TestBase.cs)
builds every unit-test context with `.UseInMemoryDatabase(Guid.NewGuid().ToString())` — there
is no SQLite anywhere under `Tests/UnitTests`. So the moment a repository method reaches for a
bulk delete, the test you would naturally write beside its neighbours in
`RepositoryTests/` stops working, and the failure is a provider exception rather than an
assertion.

`TrailImportRepository.DeleteSessionAsync` is the older instance of this, and the reason it has
no unit test at all.

## Why you reach for it anyway

The alternative is loading the entities and `RemoveRange`. For
[`MailOutboxRepository.PurgeSentBeforeAsync`](../../backend/Core/Repositories/MailOutboxRepository.cs)
that means materialising `BodyHtml` and `BodyText` — whole rendered mail bodies — for every row
being deleted, into the change tracker, to then issue one `DELETE` each. `ExecuteDeleteAsync` is
one statement and hands back the affected row count, which is exactly what the caller wants to
report. Dropping it to keep the test is the wrong trade.

## What to do instead: separate the rule from the execution

The thing actually worth testing is **which rows are eligible**, and that is an expression, not
a delete. Extract it:

```csharp
public static Expression<Func<OutboxEmail, bool>> Purgeable(DateTime cutoffUtc) =>
    e => e.Status == OutboxEmailStatus.Sent && e.SentAt != null && e.SentAt < cutoffUtc;

// and the method is then one line over it
await context.OutboxEmails.Where(Purgeable(cutoffUtc)).ExecuteDeleteAsync(ctoken);
```

The unit test runs `rows.AsQueryable().Where(MailOutboxRepository.Purgeable(cutoff))` over a
hand-built array and asserts exactly which ones match — no provider involved, so InMemory is
irrelevant. Measured: it goes red if the status check is dropped or the date field is swapped.
The integration suite, which is **SQLite and does support `ExecuteDelete`**, then proves that
the delete actually happens; see
`Tests/IntegrationTests/MailOutboxController/AdminMailOutboxControllerIntegrationTests.cs`.

That split is worth more than a workaround would be. The predicate is where the damage lives —
a purge that deletes the wrong rows cannot be undone — and testing it as data makes every
eligibility case cheap to enumerate, including the ones a seeded database makes awkward (a
`Sent` row with a null `SentAt`, whose SQL comparison is neither true nor false and which must
therefore be *spared* rather than deleted).

**Do not "fix" this by switching the unit suite to SQLite.** The InMemory provider is what makes
those 1300-odd tests run in seconds, and SQLite here drags in the SpatiaLite loading that
[[spatialite-per-os]] and [[mod-spatialite-unload-race]] exist because of.

Related: [[in-memory-queue-in-front-of-a-database-journal]] for the outbox this came from, and
[[sqlite-foreign-keys-off-on-linux]] for the other place the two providers disagree.
