# Whether develop's API still serves the shipped app is answered by diffing two exported OpenAPI specs

The app in the stores is built from `main` and keeps calling the API long after a merge, so a
`develop` -> `main` merge (backend first, app rebuild later) needs "nothing the old app uses
broke". Reading the controller diff does not answer that: on 2026-11-16 the diff was 149 commits
and 119 contract files, almost all of them formatting (block bodies, file-scoped namespaces) and
moved files. Diffing the specs answered it in one run.

## The shortcut

1. Export `main`'s spec without touching the working tree:
   `git worktree add --detach <scratch>/mainwt origin/main`, then
   `dotnet build StigviddAPI/StigviddAPI.csproj` in `<scratch>/mainwt/backend`. The build writes
   `<scratch>/mainwt/web/openapi.json` ([[openapi-contract-snapshot]]). Copy it out, then
   `git worktree remove --force` it.
2. `dotnet build` on develop writes `web/openapi.json` the same way.
3. Diff the two specs, resolving `$ref`. Go through every path+method in the old spec:
   - endpoint or parameter removed;
   - new required parameter or request property;
   - request property that is no longer nullable;
   - response property removed, retyped, or newly nullable;
   - enum value removed (requests), or added or removed (responses);
   - 2xx response code gone.
4. **Run it reversed** (develop as old, main as new). It must report the additions as removals
   (80 hits on 2026-11-16). A zero in the forward direction means nothing until the reversed run
   has shown the script can see a break at all.

## What the spec cannot show (check by hand)

- **Error shape.** `StigViddController.ToActionResult` sends ProblemDetails + `code` only for a
  `Message` with a `Code`; uncoded ones stay plain strings. `git grep` for `code:` and `*Codes.`
  in `backend/Core` lists which endpoints changed shape.
- **Validators.** Moved files show up as delete + add. Compare the rule lines, not the paths.
- **Push `data.type`.** The old app routes only the types in `NOTIFICATION_ROUTES` in
  `app/src/services/notifications.ts` (on `main`). Any other type is a tap that just opens the app.
- **Migrations.** Only the app reads old data, but the deploy migrates prod. Look for
  non-nullable adds without a default, and unique indexes over existing rows.
- **Real data.** Anonymous `GET https://staging.api.stigvidd.se/api/v1/cityareas` (and
  `api.stigvidd.se`) returns the data staging already serves. Run it through the old app's
  render logic from `git show origin/main:app/src/...`.

A trap found this way: the app used to pass `area.location` and `area.description` through
`t()`. i18next reads `:` as a namespace separator, so `"Vy:n"` rendered as `"n"`. It is fixed in
`area-detail-screen.tsx` for builds after 2026-11-16, but shipped builds still do it.
