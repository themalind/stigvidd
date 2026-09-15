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

## Configuration

`ContentReports:*` in `appsettings.json`:

| key | default | `0` means |
| --- | --- | --- |
| `MaxReportsPerUserPerDay` | 5 | no cap |
| `DismissedReportsBeforeHideIsWithheld` | 3 | every report hides |
| `SnapshotMaxLength` | 2000 | — |

Related: [auth](auth.md) for the `AdminOnly` policy the admin routes sit behind,
[media-upload](media-upload.md) for the WebDAV storage the deleted images live in.
