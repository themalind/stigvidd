<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# App conventions

The folders of `app/src/` form layers, and `eslint-plugin-boundaries` in `app/eslint.config.js`
enforces who may import whom. `npm run lint` fails on a crossed boundary, with a message that
points here. A rule that is wrong is changed here **and** in the config in the same change.

## Layers

```text
app/          expo-router routes (screens)
components/   UI, in domain subfolders            -> reusable, never inline in a route
hooks/        React Query and state hooks, in domain subfolders
atoms/        jotai atoms
services/     device and platform: auth, logger, notifications, location, dialog
api/          one module per backend area; api/core/ holds request.ts and the error types
utils/        pure helpers, in subfolders (area, event, format, geo, image, map, share)
data/         types and static data
constants/    constants (colours, BORDER_RADIUS, ...)
i18n/         translations
assets/       images and fonts
@types/       ambient type declarations
test/         the test harness (render, flush, measure, maplibre)
```

## Who may import whom

| From | May import |
| --- | --- |
| `app` | everything except `test` |
| `components` | hooks, atoms, services, api, utils, data, constants, i18n, assets |
| `hooks` | atoms, services, api, utils, data, constants, i18n, and `components/auth/auth-provider.tsx` (for `useAuth`) |
| `atoms` | services, api, data, constants, and type-only imports from `components` |
| `services` | atoms, api, data, constants, i18n, and type-only imports from `components` |
| `api` | services, data, constants, i18n |
| `utils` | services, data, constants, i18n, and `api/core/**` (error types) |
| `@types` | i18n |
| `data`, `constants`, `i18n`, `assets` | nothing in `src/` |

Nothing in production code imports `test/`, and nothing imports a route. Imports within one
folder are free. Tests (`__tests__/`, `*.test.ts(x)`, `__mocks__/`, `src/test/`) are not checked.

## Other rules

- **The API is called only through `api/core/request.ts`** (`send` / `sendForJson`). The
  `no-restricted-globals` rule refuses `fetch` everywhere else. The exceptions are
  `api/core/`, `services/keycloak-auth.ts` (Keycloak) and `services/telemetry.ts` (OpenObserve).
- Tests live in `__tests__/` beside the code they test. The harness is in `src/test/`.
- UI is a reusable component in `components/<domain>/`. Look for an existing one first.
- Modals use `ModalScrim`, never a blur. Dialogs live in `components/dialog/`.
- One border radius: `BORDER_RADIUS` (5) from the constants.
- An icon name is typed `keyof typeof MaterialCommunityIcons.glyphMap`, never `string`, or `tsc` lets a
  missing glyph through (Paper's `Icon` is MCI). Facility icons come from `constants/facility-icons.ts`.
- Licence: `app/` is MPL-2.0, and Exhibit B is never added.

## Checks

```sh
cd app && npm run format:check && npm run lint && npm test -- --watchAll=false --silent && npx tsc --noEmit
```
