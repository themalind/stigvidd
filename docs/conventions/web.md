<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Web conventions

The admin UI (`web/`) follows [bulletproof-react](https://github.com/alan2207/bulletproof-react).
The `no-restricted-imports` rules in `web/eslint.config.js` enforce the import direction, and
`npm run lint` fails on a crossed boundary. A rule that is wrong is changed here **and** in the
config in the same change.

## Layers

```text
src/app/              routes, pages.ts (one row per page), providers: composes features
src/features/<x>/     one feature: api/, components/, hooks/, ...
src/components/       shared UI
src/hooks/            shared hooks
src/utils/, lib/      shared helpers
src/config/           paths.ts and other configuration
src/api/              the generated client (orval), the mutator and the shared API helpers
src/testing/          the test harness
```

Imports go one way only: shared → features → app.

| Rule | Enforced by |
| --- | --- |
| Shared code (`api`, `lib`, `testing`, `components`, `config`, `hooks`, `utils`) imports neither `app/` nor a feature | eslint |
| A feature never imports another feature. Compose two features in `app/routes/` | eslint (the feature list is read from disk) |
| The API client (`api/generated`, `api/mutator`, `api/images`) is used only in `features/<x>/api/` and `src/api/`. Components use those hooks | eslint |
| `api/generated/model` (types) may be imported anywhere | eslint |

## Other rules

- Server data goes only through React Query in `features/<x>/api/`. Query options come from orval's
  `get…QueryOptions` / `get…QueryKey`, never from hand-made keys. Mutations toast through `meta`.
- `src/api/generated` is never edited by hand. Regenerate it after a backend contract change and
  commit it.
- A new page is one row in `app/pages.ts`. Links go through `config/paths.ts`.
- Reuse before writing: `useSearchState`, `Pager`, `useConfirm`, `ToneBadge`, `useMapLibre`, `underUrl`.
- Tests are Vitest `*.test.ts(x)` beside the source. Mock the network (`createApiMock()`), not hooks.

## Checks

```sh
cd web && npm run lint && npm run generate:api && git diff --exit-code -- src/api/generated && npm test && npm run build
```
