<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# A retention clock must not be a column that everything writes, or redaction resets it

`MailOutboxRetentionService` does two things to the same row on two different schedules:
clears its rendered body after `MailOutbox:BodyRetentionHours` (24), and deletes the row
after `MailOutbox:SettledRetentionDays` (30). Both need "when did this row settle".

`LastUpdatedAt` already exists and looks like the answer. It is not, and the failure is
silent and self-inflicted: **seven methods in `MailOutboxRepository` write it** —
`ClaimAsync`, `ReleaseAsync`, `MarkSentAsync`, `MarkFailedAsync`, `ResetInterruptedAsync`,
`RequeueAsync`, `CancelAsync` — so a redaction that also touched it would be the eighth, and
the delete rule keyed on it would push its own deadline out by the full retention period
every time the redaction rule fired. The row would be redacted on schedule and then **never
deleted at all**. The two rules would be fighting over one column, each correct in isolation.

Hence `SettledAt`, stamped when a row reaches `Failed` or `Cancelled`, mirroring what
`SentAt` already does for `Sent`. Three obligations come with it, and each is a separate way
to get it wrong:

- Stamp it **only** on `MarkFailedAsync`'s parking branch. The transient branch puts the row
  back to `Pending`, and a retention clock must not start on a mail that is still going out.
- **Null it in `RequeueAsync`**, beside the `SentAt = null` already there. A row leaving the
  terminal state has no moment at which it settled; leave it and a row that fails again keeps
  its *first* settle time and is deleted early, counting from a failure the operator already
  answered.
- **Backfill it in the migration.** The predicate spares a null `SettledAt` deliberately — a
  null in a SQL comparison is neither true nor false — so without
  `UPDATE ... SET "SettledAt" = "LastUpdatedAt" WHERE "Status" IN (3, 4)` every row that
  already existed matches nothing and lives forever. Those are precisely the rows the
  retention rule was written for. No test catches this: no suite applies a migration.

The general shape: **a timestamp that is a retention clock must be written by exactly the
transition it names, and by nothing else.** "Last touched" and "stopped moving" are different
questions, and only the second can carry a deadline.

Two measured details from proving it:

- `RedactBodiesBeforeAsync` deliberately does **not** write `LastUpdatedAt`, so "when did a
  human or the dispatcher last act on this row" stays answerable.
- Mutating the null guard out of the predicate is an **equivalent mutant** in both SQL and
  LINQ-to-Objects (`null < cutoff` is false either way). It stays because it makes the rule
  explicit, not because a test fails without it — the same argument the neighbouring
  `Purgeable` already makes.

Related: [[executedelete-cannot-be-unit-tested-here]] — the predicates here are extracted
static `Expression`s for exactly that reason, and the mutations they drive are proved in
`Tests/IntegrationTests/Mail/MailOutboxRetentionIntegrationTests.cs`.
