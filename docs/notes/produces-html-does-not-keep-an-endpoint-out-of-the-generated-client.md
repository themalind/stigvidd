<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# `[Produces("text/html")]` does not keep an endpoint out of the typed client — only `[ApiExplorerSettings(IgnoreApi = true)]` does

An endpoint that serves a page to a human's browser has no business in `web/src/api/generated`.
The intuitive way to say so is `[Produces("text/html")]`, which reads like it declares the
endpoint out of the JSON contract. **It does not.** NSwag puts it in the document anyway, and
orval then generates a client for it.

## Measured, on `verify-email`

[`AccountController.VerifyEmailByLink`](../../backend/StigviddAPI/Controllers/AccountController.cs)
has carried `[Produces("text/html")]` since it was written. It is nonetheless in the document —

```json
"/api/v1/Account/verify-email": { "get": { "responses": { "200": {
  "content": { "application/octet-stream": { "schema": { "type": "string", "format": "binary" } } } } } } }
```

— because NSwag maps the **non-generic `ActionResult`** return type to a file download and
ignores `Produces` when deciding whether to describe the action at all. orval faithfully
generated `getAccountVerifyEmailByLinkUrl`, a `Promise<Blob>` fetcher and a full set of
`useQuery` hooks in [`web/src/api/generated/account/account.ts`](../../web/src/api/generated/account/account.ts),
none of which anything in `web/src` calls or ever could usefully call.

## The lever that works

```csharp
[Produces("text/html")]
[ApiExplorerSettings(IgnoreApi = true)]   // <- this is the one
```

`IgnoreApi` removes the action from `ApiExplorer`, which is what NSwag walks. The
`reset-password` pair carries it, which is why adding two whole endpoints moved the generated
client by **one line** (an unrelated `Promise<Blob>` → `Promise<void>` from a
`ProducesResponseType` added on `forgot-password`).

Crucially it does **not** hide the route from `EndpointDataSource`, so
`EndpointAuthorizationTests` still sees it and still pins its anonymous status. You lose the
client, not the guard rail.

## Why it matters more for a form POST than for a GET

A `Blob` fetcher nobody calls is dead weight. A **`[Consumes("application/x-www-form-urlencoded")]`
POST** is worse: NSwag emits a `requestBody` with urlencoded content, orval generates that
differently from JSON, and the result can fail `tsc -b` in `web/` — breaking a package the
change otherwise never touched, and only on the Jenkins-only generated-client gate, long after
the PR looked green. See [[openapi-contract-snapshot]].

The dead `verify-email` hooks are still there. Removing them is a separate, separately
reviewable contract diff, not something to bury in an unrelated change.
