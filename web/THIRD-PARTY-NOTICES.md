<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Third-party notices — Stigvidd admin web

The admin web is licensed under AGPL-3.0-or-later (see [`../LICENSE`](../LICENSE)). It is
built from the npm packages below, used under their own terms. Licences were read from the
`license` field of each installed package in `node_modules`.

Note that this is a **browser** application: the bundle is conveyed to everyone who loads the
page, so these attributions travel with it.

## Nothing here is copyleft-blocking

Of 432 resolved packages, every one is permissive except three copies of one project:

| Package | Licence | Why it does not bite |
| --- | --- | --- |
| `lightningcss` + 2 platform binaries | MPL-2.0 | Weak, file-level copyleft, and explicitly GPL/AGPL-compatible (MPL § 3.3). A build-time CSS tool pulled in by Tailwind v4, used unmodified; its *output* is not MPL-covered. |
| `caniuse-lite` | CC-BY-4.0 | Data, not code. Build-time only (browserslist); attribution is due only if the dataset itself is redistributed. |

There is no GPL, LGPL, AGPL, SSPL, BUSL, "UNLICENSED" or bespoke-EULA package anywhere in the
tree, and no package with a missing licence field.

## Licence spread across all 432 resolved packages

| Licence | Count |
| --- | --- |
| MIT | 375 |
| Apache-2.0 | 20 |
| ISC | 15 |
| BSD-2-Clause | 8 |
| BSD-3-Clause | 4 |
| MPL-2.0 | 3 |
| MIT-0 | 2 |
| BlueOak-1.0.0 | 1 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |
| 0BSD | 1 |

## Direct dependencies

| Package | Range | Licence |
| --- | --- | --- |
| @eslint/js | ^9.39.1 | MIT |
| @tailwindcss/vite | ^4.1.18 | MIT |
| @tanstack/react-query | ^5.90.21 | MIT |
| @tanstack/react-table | ^8.21.3 | MIT |
| @testing-library/dom | ^10.4.1 | MIT |
| @testing-library/jest-dom | ^7.0.1 | MIT |
| @testing-library/react | ^16.3.2 | MIT |
| @testing-library/user-event | ^14.6.6 | MIT |
| @types/node | ^24.10.9 | MIT |
| @types/react | ^19.2.5 | MIT |
| @types/react-dom | ^19.2.3 | MIT |
| @vitejs/plugin-react | ^5.1.1 | MIT |
| class-variance-authority | ^0.7.1 | Apache-2.0 |
| clsx | ^2.1.1 | MIT |
| eslint | ^9.39.1 | MIT |
| eslint-plugin-react-hooks | ^7.0.1 | MIT |
| eslint-plugin-react-refresh | ^0.4.24 | MIT |
| fake-indexeddb | ^6.2.5 | Apache-2.0 |
| globals | ^16.5.0 | MIT |
| jsdom | ^29.1.1 | MIT |
| jwt-decode | ^4.0.0 | MIT |
| lucide-react | ^0.563.0 | ISC |
| next-themes | ^0.4.6 | MIT |
| orval | ^8.20.0 | MIT |
| radix-ui | ^1.4.3 | MIT |
| react | ^19.2.0 | MIT |
| react-dom | ^19.2.0 | MIT |
| react-router | ^7.13.0 | MIT |
| sonner | ^2.0.7 | MIT |
| tailwind-merge | ^3.4.0 | MIT |
| tailwindcss | ^4.1.18 | MIT |
| tw-animate-css | ^1.4.0 | MIT |
| typescript | ~5.9.3 | Apache-2.0 |
| typescript-eslint | ^8.46.4 | MIT |
| vite | ^7.2.4 | MIT |
| vitest | ^3.2.7 | MIT |

## Generated code

`src/api/generated/**` is emitted by [orval](https://orval.dev) (MIT) from this project's own
`openapi.json`. The generator's licence does not attach to its output; the generated client is
therefore AGPL-3.0-or-later like the rest of the admin web, declared in `../REUSE.toml`
because orval overwrites the files and would discard a header.
