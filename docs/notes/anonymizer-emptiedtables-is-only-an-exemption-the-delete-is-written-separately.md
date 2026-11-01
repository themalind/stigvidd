<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# DataAnonymizer.EmptiedTables only exempts a table from column classification; the delete is a separate line, and FriendNotes never got one

Adding a table name to `DataAnonymizer.EmptiedTables`
(`backend/Core/Services/DataTransfer/DataAnonymizer.cs`) looks like it empties the table in an
anonymised export. It does not. The set is read in exactly one place that matters:
`DataAnonymizerIntegrationTests.Classification_CoversEveryColumnOfEveryTable` skips those tables
when it checks that every column is classified as Kept, Replaced or Cleared. It executes nothing.

Emptying is done by hand, in two methods of the same file:

- `EmptyContactTablesAsync` deletes the rows for an anonymised export.
- `NeutralizeOutboundAsync` deletes the rows that could reach a person on a copy of production
  that shares its mail server and push credentials, for a non-anonymised import.

A new table that holds anything outbound or personal needs its entry in **all three** places, and a
count assertion in `Anonymize_EmptiesTheContactAndSecretTables` or
`NeutralizeOutbound_ClearsEveryWayToReachAPersonAndNothingElse`. `DomainEvents` has all three; the
mutation check removing each one turned a distinct test red.

**A measured gap that predates this note:** `FriendNotes` is listed in `EmptiedTables` (the
classification test is satisfied) but appears nowhere else in `DataTransfer/`, so it is neither
deleted by `EmptyContactTablesAsync` nor by `NeutralizeOutboundAsync`. Free-text friend notes, which
name a person, survive into an anonymised export. Verified with a search for `FriendNotes` across
`backend/Core/Services/DataTransfer/` and `backend/Tests/IntegrationTests/DataTransfer/`: one hit,
the exemption. It has not been fixed here because it is outside the domain-event change.

Related: [[a-retention-clock-must-not-be-a-column-everything-writes]] for the same "one list says
it, nothing enforces it" shape.
