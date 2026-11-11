<!--
SPDX-FileCopyrightText: 2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Site conventions

The static public site at the apex. `eslint-plugin-boundaries` in `site/eslint.config.js` enforces
the layers, and `npm run lint` fails on a crossed boundary.

```text
src/App.tsx, main.tsx   the page: composes the sections
src/components/         one section or part per file
src/content/            all copy and links, as data
src/lib/                pure helpers
src/test/               test setup
```

| From | May import |
| --- | --- |
| the page (`src/*.tsx`) | components, content, lib |
| `components` | content, lib |
| `content`, `lib` | nothing in `src/` |

Text lives in `content/`, never inline in a component, so the copy can change without touching
the markup. Tests (`*.test.ts(x)`, `src/test/`) are not checked.

## Checks

```sh
cd site && npm run lint && npm test && npm run build
```
