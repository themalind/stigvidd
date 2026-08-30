<!--
SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
SPDX-License-Identifier: MPL-2.0
-->

# Third-party notices — Stigvidd mobile app

The app is licensed under MPL-2.0 (see [`LICENSE.md`](LICENSE.md)). It bundles the npm
packages below, a font, and several proprietary platform components, each under its own terms.
Licences were read from the `license` field of each installed package in `node_modules`.

Both app stores expect these to be reachable from inside the app; the OFL in particular
requires its licence text to travel with the font.

## The font ships inside the binary

**Inter** (`@expo-google-fonts/inter`) is licensed `MIT AND OFL-1.1`. The font files themselves
are under the **SIL Open Font License 1.1**, which requires that the licence text accompany the
font, reserves the font name, and forbids selling the font on its own. It is embedded in every
release build. The full OFL text ships with the package at
`node_modules/@expo-google-fonts/inter/OFL.txt`.

## Nothing in the npm tree is copyleft-blocking

Of 1001 resolved packages there is **no** GPL-only, AGPL, SSPL, BUSL, CC-BY-NC, "UNLICENSED"
or proprietary-EULA package. The entries that are not plainly permissive:

| Package                              | Licence                             | Disposition                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lightningcss` + 2 platform binaries | MPL-2.0                             | Same licence as this app. Build-time only (the Metro/Expo web CSS pipeline), not linked into the native binary.                                                                                                                                                                        |
| `node-forge`                         | `BSD-3-Clause OR GPL-2.0`           | **The BSD-3-Clause arm is elected.** Dev tooling (the Expo dev server's TLS), not shipped.                                                                                                                                                                                             |
| `rc`                                 | `BSD-2-Clause OR MIT OR Apache-2.0` | MIT arm elected.                                                                                                                                                                                                                                                                       |
| `type-fest`                          | `MIT OR CC0-1.0`                    | MIT arm elected. Types only.                                                                                                                                                                                                                                                           |
| `caniuse-lite`                       | CC-BY-4.0                           | Data, build-time only.                                                                                                                                                                                                                                                                 |
| `qrcode-terminal`                    | "Apache 2.0"                        | A non-SPDX spelling of Apache-2.0. Dev tooling.                                                                                                                                                                                                                                        |
| `@mapbox/jsonlint-lines-primitives`  | **undeclared**                      | Declares no `license` field and ships no licence file. Its README states MIT, and upstream `zaach/jsonlint` is MIT. Build-time dependency of the MapLibre style spec. **This is the one package in 1001 whose licence is not formally declared**; treated as MIT on the README's word. |

## Licence spread across all 1001 resolved packages

| Licence                             | Count |
| ----------------------------------- | ----- |
| MIT                                 | 864   |
| ISC                                 | 45    |
| Apache-2.0                          | 26    |
| BSD-3-Clause                        | 22    |
| BSD-2-Clause                        | 22    |
| BlueOak-1.0.0                       | 5     |
| MPL-2.0                             | 3     |
| UNKNOWN                             | 2     |
| Unlicense                           | 2     |
| 0BSD                                | 2     |
| MIT AND OFL-1.1                     | 1     |
| Python-2.0                          | 1     |
| (MIT OR CC0-1.0)                    | 1     |
| CC-BY-4.0                           | 1     |
| CC0-1.0                             | 1     |
| (BSD-3-Clause OR GPL-2.0)           | 1     |
| Apache 2.0                          | 1     |
| (BSD-2-Clause OR MIT OR Apache-2.0) | 1     |

## Proprietary platform components

These are not npm packages and are not free software. The client libraries binding to them are
MIT, but the components themselves are proprietary. MPL-2.0's per-file copyleft places no
condition on combination, so linking these raises none of the questions GPLv3 § 6 would.

| Component                                            | Where                                                 | Note                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Firebase Cloud Messaging                             | every Android release build, via `expo-notifications` | Proprietary Google binary; also requires Google Play Services on the device. |
| Google Play Services Location                        | `expo-location`                                       | Proprietary; a hard dependency, with no AOSP fallback configured.            |
| Apple APNs and iOS frameworks                        | every iOS build                                       | Proprietary; unavoidable on the platform.                                    |
| Expo Push (`exp.host`) and EAS Update (`u.expo.dev`) | push and OTA updates                                  | Proprietary hosted services; the clients are MIT.                            |
| Google ML Kit / Play Services code scanner           | `expo-dev-client`                                     | Proprietary, **development builds only** — excluded from release builds.     |

## Map data

The basemap is **MapTiler Cloud**, a commercial tile service, rendered by MapLibre
(MIT client, BSD-2-Clause native SDK). Its underlying data is **OpenStreetMap, under the
Open Database License (ODbL) 1.0**, which requires attribution. The app honours this: the
MapTiler + OpenStreetMap credit is rendered on every map screen and is deliberately not
optional — see `src/components/map/map.tsx` and [`../docs/map.md`](../docs/map.md).

## Direct dependencies

| Package                                   | Range      | Licence         |
| ----------------------------------------- | ---------- | --------------- |
| @expo-google-fonts/inter                  | ^0.4.2     | MIT AND OFL-1.1 |
| @expo/vector-icons                        | ^15.0.3    | MIT             |
| @hookform/resolvers                       | ^5.2.2     | MIT             |
| @likashefqet/react-native-image-zoom      | ^4.3.0     | MIT             |
| @maplibre/maplibre-react-native           | ^11.3.4    | MIT             |
| @miblanchard/react-native-slider          | ^2.6.0     | MIT             |
| @react-native-async-storage/async-storage | ^2.2.0     | MIT             |
| @react-native-picker/picker               | 2.11.4     | MIT             |
| @react-navigation/bottom-tabs             | ^7.4.0     | MIT             |
| @react-navigation/elements                | ^2.6.3     | MIT             |
| @react-navigation/native                  | ^7.1.8     | MIT             |
| @tanstack/eslint-plugin-query             | ^5.91.2    | MIT             |
| @tanstack/react-query                     | ^5.90.11   | MIT             |
| @testing-library/jest-native              | ^5.4.3     | MIT             |
| @testing-library/react-native             | ^13.3.3    | MIT             |
| @types/geojson                            | ^7946.0.16 | MIT             |
| @types/jest                               | ~29.5.14   | MIT             |
| @types/react                              | ~19.1.0    | MIT             |
| axios                                     | 1.18.0     | MIT             |
| eslint                                    | ^9.25.0    | MIT             |
| eslint-config-expo                        | ~10.0.0    | MIT             |
| expo                                      | ~54.0.36   | MIT             |
| expo-blur                                 | ~15.0.8    | MIT             |
| expo-build-properties                     | ~1.0.10    | MIT             |
| expo-constants                            | ~18.0.13   | MIT             |
| expo-dev-client                           | ~6.0.21    | MIT             |
| expo-device                               | ~8.0.10    | MIT             |
| expo-font                                 | ~14.0.12   | MIT             |
| expo-haptics                              | ~15.0.8    | MIT             |
| expo-image                                | ~3.0.11    | MIT             |
| expo-image-manipulator                    | ~14.0.8    | MIT             |
| expo-image-picker                         | ~17.0.11   | MIT             |
| expo-linear-gradient                      | ~15.0.8    | MIT             |
| expo-linking                              | ~8.0.12    | MIT             |
| expo-location                             | ~19.0.8    | MIT             |
| expo-navigation-bar                       | ~5.0.10    | MIT             |
| expo-notifications                        | ~0.32.17   | MIT             |
| expo-router                               | ~6.0.24    | MIT             |
| expo-secure-store                         | ~15.0.8    | MIT             |
| expo-splash-screen                        | ~31.0.13   | MIT             |
| expo-status-bar                           | ~3.0.9     | MIT             |
| expo-symbols                              | ~1.0.8     | MIT             |
| expo-system-ui                            | ~6.0.9     | MIT             |
| expo-task-manager                         | ~14.0.9    | MIT             |
| expo-updates                              | ~29.0.19   | MIT             |
| expo-web-browser                          | ~15.0.11   | MIT             |
| geolib                                    | ^3.3.4     | MIT             |
| i18next                                   | ^26.2.0    | MIT             |
| jest                                      | ^29.7.0    | MIT             |
| jest-expo                                 | ~54.0.17   | MIT             |
| jotai                                     | ^2.15.1    | MIT             |
| jotai-tanstack-query                      | ^0.11.0    | MIT             |
| jwt-decode                                | ^4.0.0     | MIT             |
| prettier                                  | 3.6.2      | MIT             |
| react                                     | 19.1.0     | MIT             |
| react-dom                                 | 19.1.0     | MIT             |
| react-hook-form                           | ^7.66.0    | MIT             |
| react-i18next                             | ^17.0.8    | MIT             |
| react-native                              | 0.81.5     | MIT             |
| react-native-gesture-handler              | ~2.28.0    | MIT             |
| react-native-keyboard-aware-scroll-view   | 0.9.5      | MIT             |
| react-native-paper                        | ^5.14.5    | MIT             |
| react-native-reanimated                   | ~4.1.1     | MIT             |
| react-native-reanimated-carousel          | ^4.0.3     | MIT             |
| react-native-safe-area-context            | ~5.6.0     | MIT             |
| react-native-screens                      | ~4.16.0    | MIT             |
| react-native-star-rating-widget           | ^1.10.0    | MIT             |
| react-native-svg                          | 15.12.1    | MIT             |
| react-native-uuid                         | ^2.0.3     | MIT             |
| react-native-web                          | ~0.21.0    | MIT             |
| react-native-worklets                     | 0.5.1      | MIT             |
| typescript                                | ~5.9.2     | Apache-2.0      |
| zod                                       | ^3.25.76   | MIT             |
