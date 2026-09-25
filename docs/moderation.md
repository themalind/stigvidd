<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Moderation — Content Reports

How a user reports a review or a trail obstacle, what the report does to that content
straight away, and how an admin decides it in the web dashboard. This is a behavioural
reference: upholding a report **hard-deletes** the content, so most of the shape below exists
to make that one irreversible step safe.

## Key files

| Concern | File |
| --- | --- |
| Report form (app) | `app/src/components/report/report-content-form.tsx`, opened from `review-section.tsx` and `trail-obstacle-item.tsx` |
| Public endpoints | `backend/StigviddAPI/Controllers/ContentReportsController.cs` |
| Admin endpoints | `backend/StigviddAPI/Controllers/Admin/AdminContentReportsController.cs` |
| Rules: cap, hide decision, decide | `backend/Core/Services/ContentReportService.cs` |
| Hide / restore / delete, account deletion | `backend/Core/Repositories/ContentReportRepository.cs` |
| The report row | `backend/Infrastructure/Data/Entities/ContentReport.cs` |
| The hidden-content filter | `backend/Infrastructure/Data/StigViddDbContext.cs` (`HasQueryFilter("Moderation", …)`) |
| Moderation page (web) | `web/src/pages/admin/moderation-page.tsx` |
| Decide-button rules, strike and accuracy arithmetic (tested) | `web/src/lib/moderation-review.ts`, `web/src/lib/moderation-statistics.ts` |

## What can be reported

`ReportedContentType` is `Review` or `TrailObstacle`. Reasons are `Offensive`, `Spam`,
`PersonalData`, `Misinformation` and `Other`, served to the app by
`GET api/v1/contentreports/reasons`, with an optional free-text note.

`POST api/v1/contentreports` (any signed-in user) refuses, with nothing written:

| | |
| --- | --- |
| unknown content type | 400 (an unrecognised *reason* is stored as `Other`) |
| reporting your own content | 400 |
| the content does not exist (or is already gone) | 404 |
| you have already reported this content | 409 — also a unique index on (reporter, type, id) |
| already `ContentReports:MaxReportsPerUserPerDay` (5) reports in a **rolling** 24 h | 429; `0` disables the cap |

## A report hides the content immediately

Both reportable tables carry a `ModerationState` (`Visible` / `HiddenPendingReview`) and a
**named global query filter**, `"Moderation"`, that only lets `Visible` rows through. So a
hidden review disappears from every read in the API — including the trail rating averages,
which reach reviews through a navigation ([note](notes/query-filter-reaches-navigation-aggregates.md)).
Code that must see hidden rows opts out by name: `IgnoreQueryFilters(["Moderation"])`.

Each report records what it did as `HideOutcome`:

| `HideOutcome` | when |
| --- | --- |
| `Hidden` | the normal case — this report hid the content |
| `AlreadyHidden` | an earlier report had already hidden it |
| `WithheldReporterDismissed` | the reporter has at least `ContentReports:DismissedReportsBeforeHideIsWithheld` (3) **dismissed** reports; the report still enters the queue but hides nothing. `0` disables this |

The last one is what stops a single user from repeatedly hiding content they merely
dislike, without silencing them: the moderator still sees the report, and the queue says
why nothing was hidden.

The report keeps a **snapshot** of the content text (clipped to
`ContentReports:SnapshotMaxLength`, 2000) and the author's nickname. Upholding deletes the
content, so the snapshot is all that remains of what the moderator judged.

## Deciding

`POST api/v1/admin/content-reports/reports/{identifier}/decide` with `Dismiss` or `Uphold`
and an optional note. The decision applies to **every pending report on the same content**,
not just the one opened.

| decision | effect on the content | report status |
| --- | --- | --- |
| **Dismiss** | restored to `Visible` | `Dismissed` — or `ContentExpired` if the content is already gone |
| **Uphold** | **hard-deleted** (an obstacle's solved-votes with it; a review's image files are removed from WebDAV afterwards, best-effort and logged) | `Upheld` — a strike against the author |

- **Idempotent.** The same decision again changes nothing and does not rewrite who decided.
- **A contradicting decision is a 409.** Once upheld there is nothing left to dismiss.
- **`ContentExpired` can still be upheld.** Obstacle retention may remove the content before
  anyone decides; the strike must still land, or a repeat author escapes on timing.
- Image files are deleted **after** the database commit: a failure then leaves a recoverable
  stray file, rather than lost images for content that stays up.

The web page adds one guard of its own: **Uphold stays disabled until the moderator has
opened the content**, because it cannot be undone. Dismiss has no such gate.

## The statistics

The admin page also lists reporters and authors (`GET …/reporters`, `GET …/authors`,
`GET …/counts`):

- **Strikes** are upheld reports against an author. The page grades one or two as *watch*
  and three or more as *serious* — these numbers are what a decision to remove an
  account rests on.
- **Reporter accuracy** is upheld ÷ decided. Pending reports are not evidence, so a reporter
  with nothing decided has *no* accuracy rather than 0 %.
- A reporter is flagged once they reach the same dismissed-report threshold the hide
  decision reads, so the flag means exactly "their next report will not hide anything".

## When a user deletes their account

`ContentReportRepository.HandleUserDeletionAsync` runs **before** the user row is removed
(afterwards `ReporterUserId` is already nulled and their reports cannot be found):

- **As an author:** snapshots are cleared, pending reports become `ContentExpired`, and the
  content is restored to `Visible` — it is already anonymised, and leaving it hidden would
  drop a legitimate rating from the trail average forever.
- **As a reporter:** only their free-text note is removed. The reports still point at content
  that exists and still need a decision.

## Banning and blocking — the other half, and not this queue

Deciding a report settles *content*. The two things that act on a *person* are separate from it
and from each other, and they are not the same word:

| | who does it | what it does |
| --- | --- | --- |
| **ban** | a moderator, from the Author card in this queue or from **Users → Authors** | the account keeps reading the app and can no longer write to it |
| **block** | any user, from their own friends list | that person disappears for them, and is never told |

A ban is **read-only, not a lockout**. The account signs in as before, browses trails, reads
reviews and keeps its own hike log; what it loses is everything that reaches someone else — a
review, an obstacle report, a solved vote, a friend request, a share, an edit to a hike that
recipients already see. An unlifted row in `UserBans` is the
gate itself, and `StigviddAPI/Authorization/BannedUserWriteFilter.cs` is what enforces it:
every non-GET is refused unless the endpoint carries `[AllowWhenBanned]`. Keycloak is
deliberately not involved — disabling the user there would bar sign-in, which is the one thing
a ban must not do.

Deleting is never taken away. A banned user can still remove their own reviews and obstacle
reports, block someone, leave a friendship, and delete their account.

`UserBans` is the history: one row per ban, with `BannedBy` and `Reason` for who and why, and
`LiftedAt`/`LiftedBy` once it is lifted. Lifting stamps the row rather than deleting it, and a
new ban adds a row, so every earlier ban survives. A partial unique index allows at most one
unlifted row per user, and banning an account that is already banned is a **409** that leaves
the first ban untouched — two moderators acting on the same author from stale pages cannot
overwrite each other. The rows cascade with the account when it is deleted. **Users →
Authors** shows the count as **Bans**, lifted ones included. The
`strikeSeverity` grading in `web/src/lib/moderation-statistics.ts` (one or two is *watch*,
three or more is *serious*) is the list that decision is made from.

Banning from the Author card works for a review and an obstacle report alike, and records the
report's identifier as the reason. It leaves the content where it is: what stays published is
decided per item, above. Both places read the active ban's `BannedAt` back, so an account already banned
shows **Banned** with the date and offers to lift it in place of the Ban button, and the queue
and the Authors list are re-read afterwards — the buttons are chosen from the response, so a
stale list would offer the action just taken.

A **user** block is one-way and silent. It hides that person's reviews, obstacle reports,
solved votes, search entry, friends-list row, friend requests and shared walks from the reader
who blocked them — a walk a mutual friend reshares still arrives, in that friend's name — and
suppresses the notifications they would have triggered. Nothing is refused and nothing is
deleted: the friendship and the shared walks stay in place, and the blocked person's own view of
the app is untouched, so they are never able to tell. A refusal would give it away outright,
since they know they did not block anyone.

Unpleasant content is reported, not blocked: the report is what reaches a moderator, and a
reader who never wants to see that person again blocks them from the friends list. So the
report sheet in the app offers no block — for an obstacle report it could not even name who,
since those are shown without a name.

A block is undone from the same screen: the friends list grows a **Blockerade** section, shown
only when there is someone in it. There is nowhere else to undo it — a block is silent to the
person blocked, so no notification or request carries it.

See [notes/ban-is-read-only-block-is-per-viewer.md](notes/ban-is-read-only-block-is-per-viewer.md).

## Configuration

`ContentReports:*` in `appsettings.json`:

| key | default | `0` means |
| --- | --- | --- |
| `MaxReportsPerUserPerDay` | 5 | no cap |
| `DismissedReportsBeforeHideIsWithheld` | 3 | every report hides |
| `SnapshotMaxLength` | 2000 | — |

Related: [auth](auth.md) for the `AdminOnly` policy the admin routes sit behind,
[media-upload](media-upload.md) for the WebDAV storage the deleted images live in.
