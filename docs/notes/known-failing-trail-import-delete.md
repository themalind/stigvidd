# Known failing: TrailImport DeleteSessionAsync's cascade does not fire under SQLite

`IntegrationTests.TrailImport.TrailImportReviewIntegrationTests.DeleteSessionAsync_ShouldTakeTheProposalsWithItAndLeaveTheTrailsAlone`

fails with

```
Expected (context.TrailImportProposals.CountAsync(p => p.SessionId == sessionId, ...))
  to be 0, but found 2 (difference of 2).
```

**It is pre-existing on `develop`.** Measured by running the suite at `0e1a99e` in a clean
detached worktree: 1358 tests, 2 failures — this one, and `OpenApiContractTests` for the
unrelated worktree reason ([git-worktree-repo-root](git-worktree-repo-root.md)). Do not spend
a round attributing it to your own change; check this note first
([attribute-failure](../../.claude/skills/attribute-failure/SKILL.md) is the procedure).

## The mechanism, as far as it is verified

The cascade is declared in the model:

```csharp
// Infrastructure/Data/StigViddDbContext.cs:231
modelBuilder.Entity<TrailImportProposal>()
    .HasOne(p => p.Session).WithMany(s => s.Proposals)
    .HasForeignKey(p => p.SessionId)
    .OnDelete(DeleteBehavior.Cascade);
```

but `TrailImportRepository.DeleteSessionAsync` deletes with **`ExecuteDeleteAsync()`**, which
issues a server-side `DELETE` and **bypasses EF's change tracker**. EF's own cascade fix-up
therefore never runs: the delete has to be cascaded by the *database*. PostgreSQL does that
from the FK's `ON DELETE CASCADE`. Under the test provider it evidently does not — the two
proposals survive.

Two candidates, neither confirmed:

- SQLite foreign-key enforcement is not on for this connection. `WebApplicationFactory` opens
  `new SqliteConnection("DataSource=:memory:")` with no `Foreign Keys=` setting.
- `Database.EnsureCreated()` did not emit the `ON DELETE CASCADE` clause into the SQLite
  schema at all.

**And it may be platform-dependent.** On Linux this suite binds the *system* libsqlite3 via
`SQLite3Provider_sqlite3`, while Windows uses the bundled `e_sqlite3`
([spatialite-per-os](spatialite-per-os.md)) — different SQLite builds can differ on
foreign-key defaults. The measurement above is Gentoo only; whether this test is red on
Windows is unknown and worth one run.

## What it means for the assertion

Either way, the test as written cannot prove what it claims on a provider that does not
enforce the FK, and it would go green against PostgreSQL while proving nothing locally — the
[prove-it-bites](../../.claude/skills/prove-it-bites/SKILL.md) shape. Fixing it means enabling
foreign keys on the test connection (and confirming the schema carries the cascade), not
changing the repository.

Related: [[spatialite-per-os]], [[git-worktree-repo-root]].
