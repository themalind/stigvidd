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

Of 1396 packages in `package-lock.json`, counting every platform's binaries, there is **no** GPL-only, AGPL, SSPL, BUSL, CC-BY-NC, "UNLICENSED"
or proprietary-EULA package. The entries that are not plainly permissive:

| Package                               | Licence                   | Disposition                                                                                                     |
| ------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `lightningcss` + 11 platform binaries | MPL-2.0                   | Same licence as this app. Build-time only (the Metro/Expo web CSS pipeline), not linked into the native binary. |
| `node-forge`                          | `BSD-3-Clause OR GPL-2.0` | **The BSD-3-Clause arm is elected.** Dev tooling (the Expo dev server's TLS), not shipped.                      |
| `fb-dotslash`                         | `MIT OR Apache-2.0`       | MIT arm elected.                                                                                                |
| `type-fest`                           | `MIT OR CC0-1.0`          | MIT arm elected. Types only.                                                                                    |
| `caniuse-lite`                        | CC-BY-4.0                 | Data, build-time only.                                                                                          |

## Licence spread across all 1396 packages in the lockfile

| Licence                   | Count |
| ------------------------- | ----- |
| MIT                       | 1225  |
| ISC                       | 66    |
| BSD-3-Clause              | 26    |
| Apache-2.0                | 25    |
| BSD-2-Clause              | 20    |
| MPL-2.0                   | 12    |
| BlueOak-1.0.0             | 9     |
| Unlicense                 | 2     |
| 0BSD                      | 2     |
| (MIT OR CC0-1.0)          | 2     |
| MIT-0                     | 1     |
| MIT AND OFL-1.1           | 1     |
| Python-2.0                | 1     |
| CC-BY-4.0                 | 1     |
| (MIT OR Apache-2.0)       | 1     |
| CC0-1.0                   | 1     |
| (BSD-3-Clause OR GPL-2.0) | 1     |

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
MapTiler + OpenStreetMap credit and the MapTiler logo (MapTiler AG's trademark, required
by the Free plan) are rendered on every map screen and is deliberately not
optional — see `src/components/map/map.tsx` and [`../docs/map.md`](../docs/map.md).

## Direct dependencies

| Package                                   | Range      | Licence         |
| ----------------------------------------- | ---------- | --------------- |
| @expo-google-fonts/inter                  | ^0.4.2     | MIT AND OFL-1.1 |
| @expo/vector-icons                        | ^15.0.3    | MIT             |
| @hookform/resolvers                       | ^7.0.5     | MIT             |
| @likashefqet/react-native-image-zoom      | ^4.3.0     | MIT             |
| @maplibre/maplibre-react-native           | 11.5.1     | MIT             |
| @miblanchard/react-native-slider          | ^2.6.0     | MIT             |
| @react-native-async-storage/async-storage | ^2.2.0     | MIT             |
| @react-native-community/netinfo           | 12.0.1     | MIT             |
| @react-native-picker/picker               | 2.11.4     | MIT             |
| @react-native/jest-preset                 | ^0.88.1    | MIT             |
| @tanstack/eslint-plugin-query             | ^5.91.2    | MIT             |
| @tanstack/react-query                     | ^5.90.11   | MIT             |
| @testing-library/jest-native              | ^5.4.3     | MIT             |
| @testing-library/react-native             | ^14.1.0    | MIT             |
| @types/geojson                            | ^7946.0.16 | MIT             |
| @types/jest                               | 30.0.0     | MIT             |
| @types/react                              | ~19.3.0    | MIT             |
| axios                                     | 1.21.0     | MIT             |
| eslint                                    | ^9.25.0    | MIT             |
| eslint-config-expo                        | ~58.0.4    | MIT             |
| expo                                      | ^58.0.0    | MIT             |
| expo-blur                                 | ~58.0.5    | MIT             |
| expo-build-properties                     | ~58.0.12   | MIT             |
| expo-constants                            | ~58.0.15   | MIT             |
| expo-dev-client                           | ~58.0.18   | MIT             |
| expo-device                               | ~58.0.5    | MIT             |
| expo-file-system                          | ~58.0.13   | MIT             |
| expo-font                                 | ~58.0.11   | MIT             |
| expo-image                                | ~58.0.18   | MIT             |
| expo-image-manipulator                    | ~58.0.16   | MIT             |
| expo-image-picker                         | ~58.0.10   | MIT             |
| expo-linear-gradient                      | ~58.0.3    | MIT             |
| expo-linking                              | ~58.0.16   | MIT             |
| expo-location                             | ~58.0.20   | MIT             |
| expo-navigation-bar                       | ~58.0.4    | MIT             |
| expo-notifications                        | ~58.1.8    | MIT             |
| expo-router                               | ~58.0.30   | MIT             |
| expo-secure-store                         | ~58.0.2    | MIT             |
| expo-splash-screen                        | ~58.0.13   | MIT             |
| expo-status-bar                           | ~58.0.4    | MIT             |
| expo-system-ui                            | ~58.0.7    | MIT             |
| expo-task-manager                         | ~58.0.13   | MIT             |
| expo-updates                              | ~58.0.21   | MIT             |
| geolib                                    | ^4.0.2     | MIT             |
| i18next                                   | ^27.0.1    | MIT             |
| jest                                      | ~30.5.2    | MIT             |
| jest-expo                                 | ~58.0.14   | MIT             |
| jotai                                     | ^3.0.2     | MIT             |
| jotai-tanstack-query                      | ^0.11.0    | MIT             |
| jwt-decode                                | ^4.0.0     | MIT             |
| prettier                                  | 3.9.10     | MIT             |
| react                                     | 19.3.0     | MIT             |
| react-dom                                 | 19.3.0     | MIT             |
| react-hook-form                           | ^7.66.0    | MIT             |
| react-i18next                             | ^18.0.1    | MIT             |
| react-native                              | 0.88.1     | MIT             |
| react-native-gesture-handler              | ~3.3.0     | MIT             |
| react-native-keyboard-aware-scroll-view   | 0.9.5      | MIT             |
| react-native-paper                        | ^5.14.5    | MIT             |
| react-native-paper-dates                  | 0.24.2     | MIT             |
| react-native-reanimated                   | 4.7.1      | MIT             |
| react-native-reanimated-carousel          | ^4.0.3     | MIT             |
| react-native-safe-area-context            | ~5.11.1    | MIT             |
| react-native-screens                      | ~4.30.1    | MIT             |
| react-native-star-rating-widget           | ^1.10.0    | MIT             |
| react-native-svg                          | 15.16.0    | MIT             |
| react-native-uuid                         | ^2.0.3     | MIT             |
| react-native-web                          | ~0.21.0    | MIT             |
| react-native-worklets                     | 0.13.0     | MIT             |
| test-renderer                             | ^1.3.1     | MIT             |
| typescript                                | ~6.0.3     | Apache-2.0      |
| zod                                       | ^4.6.7     | MIT             |
