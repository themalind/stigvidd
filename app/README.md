# Stigvidd — mobile app

The Android and iOS app, built with Expo (SDK 54), Expo Router and MapLibre. Licensed
**MPL-2.0** — see [LICENSE.md](LICENSE.md).

Setup, the `.env` variables and the EAS build/update workflow are in the
[root README](../README.md#mobile-app). The short version:

```bash
npm ci
npx expo run:android        # or run:ios — builds and installs a development build
npx expo start              # the dev server; keeps running
```

Expo Go does **not** work: MapLibre and push notifications need native modules, so the app
only runs as a development build.

## Checks

```bash
npm run format:check        # prettier
npm run lint                # eslint
npm test -- --watchAll=false
npx tsc --noEmit            # CI does not type-check the app, so run this yourself
```

## Layout

| | |
| --- | --- |
| `src/app/` | Expo Router routes — one stack per tab under `(tabs)/` |
| `src/components/` | Screens and UI, grouped by feature (`map/`, `trail/`, `auth/`, …) |
| `src/api/` | Backend calls |
| `src/services/` | Auth, location tracking, notifications, logging |
| `src/i18n/` | Swedish and English strings |
| `src/test/` | Shared test harness |
| `modules/` | Local native modules (the iOS background-location engine) |

Behaviour that is easy to break is documented in [docs/](../docs/) — in particular
[map.md](../docs/map.md), [record-hike.md](../docs/record-hike.md) and
[auth.md](../docs/auth.md).
