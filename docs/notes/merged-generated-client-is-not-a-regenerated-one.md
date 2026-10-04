# A clean git merge of two client regenerations is not a regenerated client

Measured 2026-10-04. Two changes each regenerated `web/src/api/generated`:

- `adb0e716` (dashboard) added `adminDashboardResponse` and `adminDashboardReviewResponse`
  to `web/src/api/generated/model/index.ts`;
- `70a175a3` (export/import), whose client was generated **before** the dashboard change,
  added `export * from './adminExportParams';`.

Git combined them without a conflict and put the new line at its pre-dashboard position,
above `adminDashboardResponse`. orval writes that file in alphabetical order (D before E), so
regenerating moves the line. Jenkins' web stage then failed with
"ERROR: the generated API client is stale." even though every file in it was current.
Only the order was wrong.

## Why it looks fine

- The merge was clean, and so are `npm run build` and `npm test`. A reordered
  `export *` changes nothing at compile time or runtime.
- The GitHub web job does not run the staleness gate. Only the Jenkinsfile does, on `main`
  (see [[openapi-contract-snapshot]]). The red build shows up after the merge to `main`,
  far from the commit that caused it.
- The error message says "stale", which suggests a missing regeneration. Here the client
  had been regenerated, just on a different base.

## Rule

After any merge, rebase or cherry-pick that touches `web/src/api/generated`, run
`cd backend && dotnet build`, then `cd web && npm run generate:api`, and commit whatever
moves. Fix it the same way. Expect a one-line move in `model/index.ts` (or `index.ts`).

Related: [[diff-exit-code-pathspec-fails-open]], [[line-endings-and-generated-files]].
