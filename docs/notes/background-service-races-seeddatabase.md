# A new BackgroundService not added to WebApplicationFactory.cs's exclusion list races SeedDatabase, and the failures land on unrelated tests

Adding `MediaReprocessDispatcher` and `MediaReprocessRetentionService`
(`backend/StigviddAPI/BackgroundServices/`) as `AddHostedService<...>()` in `Program.cs`
turned the integration suite non-deterministic: 45–59 failing tests, but a **different set
each run** — `AccountControllerTests`/`HikeSharesControllerTests` one run,
`FriendsControllerTests`/`HikesControllerIntegrationTests`/`MailOutboxRetentionIntegrationTests`/
`TrailImportRepositoryIntegrationTests` the next.

A clean worktree of the same commit ran all 1845 tests green, which ruled out pre-existing
flakiness. The actual cause was in the log the whole time, buried under the failures it
caused: `fail: Microsoft.EntityFrameworkCore.Database.Command` /
`SQLite Error 1: 'no such table: MediaReprocessItems'`. The two new hosted services start
immediately when the test host boots — the dispatcher's startup recovery sweep queries
`MediaReprocessItems` right away, the retention service runs its sweep once at startup too —
and `StigViddWebApplicationFactory.SeedDatabase()` (`Tests/IntegrationTests/WebApplicationFactory.cs`)
calls `context.Database.EnsureDeleted()` then `EnsureCreated()` on the **same shared
in-memory SQLite connection** that every test class in the process uses. Whichever table the
new service happened to query while another test's fixture was mid-`EnsureCreated()` came
back missing, and which test that was is a race — hence a different failure set per run.

`WebApplicationFactory.cs` already has exactly this problem solved for four other services
(`ExpiredObstacleCleanupService`, `TrailImportAnalysisWorker`, `MailOutboxDispatcher`,
`MailOutboxRetentionService`) via a `startupServices` filter that removes them by
`ImplementationType` before the test host starts, with the comment "Their startup runs race
SeedDatabase on the shared in-memory connection" right above it. That filter is **not**
applied automatically to a new hosted service — it is a hand-maintained list, so it must be
extended every time `Program.cs` gains one, or the new service silently reintroduces the
exact race the comment is warning about.

## What to check when adding a new `BackgroundService`

If it does anything at startup (a recovery sweep, a first retention pass, anything that
touches `IDbContextFactory<StigViddDbContext>` before the first request), add its
`typeof(YourService)` to the `startupServices` filter in
`Tests/IntegrationTests/WebApplicationFactory.cs` in the same edit that registers it in
`Program.cs`. Confirm with a **full** `dotnet test` run (not a filtered one) two or three
times — a single green run proves nothing when the failure is a race across shared state.

Related: [[in-memory-queue-in-front-of-a-database-journal]], whose write-then-signal/
re-signal-on-boot rules are exactly what makes a dispatcher's startup sweep necessary in the
first place — and therefore exactly what makes it dangerous to skip this exclusion.
