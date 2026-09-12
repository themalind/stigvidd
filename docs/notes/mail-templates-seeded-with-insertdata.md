# Seed an operator-editable table with `InsertData`, never `HasData` — `HasData` makes EF the owner and reverts their edits

`MailTemplates` exists so mail wording can be corrected **without a deploy**: an operator edits
the row, and the next mail uses it. That requirement rules out the obvious way to ship the
starting rows.

## What `HasData` actually promises

`modelBuilder.Entity<MailTemplate>().HasData(...)` does not mean "insert these once". It
declares the rows as **part of the model**. EF then diffs them like any other model element on
every migration scaffold, and emits `UpdateData` for whatever no longer matches the
declaration — which, for a row an operator has edited, is a migration that silently puts the
old wording back on the next deploy.

The trap is the timing. The seed works, the edit works, and nothing goes wrong until somebody
adds an *unrelated* migration months later and EF quietly includes the revert in it.

`HasData` also fights `BaseEntity`, though this is the lesser problem. `Identifier`,
`CreatedAt` and `LastUpdatedAt` are property initialisers (`Guid.NewGuid()`, `DateTime.UtcNow`),
so a `HasData` entry that does not pin all three to constants produces a *different* model on
every scaffold, and every migration carries a spurious data change.

## What to do instead

Hand-write `migrationBuilder.InsertData` in the scaffolded migration body. It is a plain
one-time `INSERT` that EF never looks at again, so an operator's edit survives. CLAUDE.md
permits editing a migration's own `.cs` body, and `guard-generated-files.mjs` only *warns* on
it — deny is reserved for `*ModelSnapshot.cs` and `*.Designer.cs`. See
[`20260912103250_AddMailOutbox.cs`](../../backend/Infrastructure/Migrations/20260912103250_AddMailOutbox.cs).

**Omit the `Id`.** The column is `IdentityByDefaultColumn`, so an explicit `Id` inserts fine but
does not advance the sequence — and the next row added through the application collides on the
primary key. That is what [`reseed-identity-sequences.sql`](../../backend/reseed-identity-sequences.sql)
exists to clean up; do not create more work for it.

## The cost, which is real but small

Nothing in the test suite applies a migration — the suites are SQLite/InMemory and use
`EnsureCreated`. `HasData` rows *would* have appeared there for free. With `InsertData` they do
not, so a test needing a template seeds its own; see
`Tests/IntegrationTests/Mail/MailOutboxIntegrationTests.cs`.

That is a feature more than a cost: the fixture states which template it depends on instead of
inheriting one, and a test cannot start passing because production seed data happened to change.

The rule generalises. **`HasData` is right for a lookup table the application owns and nobody
edits** — a list of statuses, a set of fixed categories. It is wrong for anything a human is
expected to change in place.

Related: [[in-memory-queue-in-front-of-a-database-journal]] for the other half of this feature,
and `docs/mail.md` for the table itself.
