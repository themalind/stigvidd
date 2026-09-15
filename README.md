# Stigvidd

Stigvidd is a full-stack hiking and trail discovery application built as a thesis project. It lets users explore hiking trails in the Borås area, record their own hikes with GPS tracking, rate and review trails, and report obstacles along the way.

The project consists of three parts: a cross-platform mobile app, a web-based admin dashboard, and a REST API backend.

<figure>
  <img src="app/src/assets/images/mammaapp.png">
</figure>

---

## Screenshots

<table>
  <tr>
    <td align="center"><b>Login</b></td>
    <td align="center"><b>Start screen</b></td>
    <td align="center"><b>Profile</b></td>
    <td align="center"><b>Favorites</b></td>
  </tr>
  <tr>
    <td><img src="screenshots/log-in-screen.jpg" width="180"/></td>
    <td><img src="screenshots/start-screen.jpg" width="180"/></td>
    <td><img src="screenshots/user-profile-screen.jpg" width="180"/></td>
    <td><img src="screenshots/my-favorites-screen.jpg" width="180"/></td>
  </tr>
  <tr>
    <td align="center"><b>Trail detail</b></td>
    <td align="center"><b>Trail info & obstacles</b></td>
    <td align="center"><b>Practical info</b></td>
    <td align="center"><b>Trail list</b></td>
  </tr>
  <tr>
    <td><img src="screenshots/trail-detail-screen.jpg" width="180"/></td>
    <td><img src="screenshots/trail-information.jpg" width="180"/></td>
    <td><img src="screenshots/trail-practical-info.jpg" width="180"/></td>
    <td><img src="screenshots/trail-filter-screen.jpg" width="180"/></td>
  </tr>
  <tr>
    <td align="center"><b>Map overview</b></td>
    <td align="center"><b>Map filter</b></td>
    <td></td>
    <td></td>
  </tr>
  <tr>
    <td><img src="screenshots/map_overview.jpg" width="180"/></td>
    <td><img src="screenshots/map_filter.jpg" width="180"/></td>
    <td></td>
    <td></td>
  </tr>
</table>

---

## Architecture

```
stigvidd/
├── app/          # Mobile app (React Native / Expo)
├── web/          # Admin dashboard (React / Vite)
├── backend/      # REST API + domain logic (ASP.NET Core / C#)
│   ├── StigviddAPI/        # Controllers (admin ones under Controllers/Admin), background services, startup
│   ├── Core/               # Services, repositories, validators, factories, spatial helpers,
│   │                       #   and TrailImport/ (the Borås trail sync)
│   ├── Infrastructure/     # EF Core entities, DbContext, migrations
│   ├── WebDataContracts/   # Request/response DTOs
│   └── Tests/              # Unit and integration tests
├── docs/         # Behavioural references (see Documentation below)
├── db/ keycloak/ media/ proxy/ scripts/   # The docker compose stack and its host scripts
├── docker-compose.yml
├── DEPLOYMENT.md # Production host runbook
└── STAGING.md    # Staging host runbook
```

---

## Tech Stack

### Mobile App

- React Native with Expo (SDK 54)
- TypeScript
- Expo Router (file-based routing)
- MapLibre Native + MapTiler "Outdoor" vector tiles, with Expo Location (GPS tracking)
- TanStack Query (server state) + Jotai (global state)
- React Hook Form + Zod (form validation)
- React Native Paper (Material Design 3)
- Expo Notifications (push notifications)
- i18next / react-i18next (Swedish + English, in progress — not yet user-facing)

### Admin Dashboard

- React 19 with Vite
- TypeScript
- React Router v7
- TanStack Query + TanStack Table
- Tailwind CSS v4 + Radix UI
- TipTap (mail template editor)
- orval (API client generated from the backend's OpenAPI spec)
- Vitest + Testing Library
- Keycloak (JWT / OpenID Connect)

### Backend

- ASP.NET Core 10 (Web API)
- C# / .NET 10
- Entity Framework Core 10 with PostgreSQL + PostGIS
- Keycloak (JWT / OpenID Connect)
- FluentValidation with auto-validation middleware
- Magick.NET for image processing, WebDAV for image file storage
- MailKit, behind a database-backed mail outbox
- NSwag / Swagger for API docs
- OpenTelemetry → self-hosted OpenObserve (logs, traces, metrics); the app and admin web ship logs to it too

---

## Features

- Browse and filter hiking trails (difficulty, accessibility, length, distance, city)
- Interactive map with trail markers and GPS coordinates
- Background GPS tracking during hikes with distance calculation
- Trail reviews with star ratings and photos
- Favorites and wishlist with optimistic UI updates
- Report trail obstacles/hazards with a voting system
- Report offensive or incorrect reviews and obstacles for moderation
- Share completed hikes with friends, who can follow the route on the map
- Push notifications
- Email verification on registration
- User profiles with hike history
- Admin dashboard: trails, facilities and media, the Borås trail-import review, the
  moderation queue, editable mail templates, and whole-environment export/import

> **In progress:** Swedish/English language support (i18n) is being built but not yet user-facing.

---

## Getting Started

### Prerequisites

- Node.js 22 or 24 (**not** 26 — the web test suite fails on it; CI and the web image use Node 24)
- .NET 10 SDK
- PostgreSQL with the PostGIS extension (local or remote)
- A Keycloak realm (for backend, mobile app and admin dashboard authentication)
- A MapTiler API key and style id (for map tiles in the mobile app)
- An Android/iOS device or emulator with a **development build** of the app — Expo Go is not
  supported, because MapLibre and push notifications need native modules
- Docker, if you want to run the whole stack (`docker compose up -d`) — see [DEPLOYMENT.md](DEPLOYMENT.md)

---

### Backend

1. Navigate to the API project:

   ```bash
   cd backend/StigviddAPI
   ```

2. Set up user secrets with your connection string:

   ```bash
   dotnet user-secrets set "ConnectionStrings:StigVidd" "your_connection_string"
   ```

3. Configure your Keycloak realm settings (`Keycloak` and `KeycloakAdminClient` sections) in `appsettings.json` or user secrets.

4. Apply database migrations. EF Core commands run from `backend/` with `Infrastructure` as both
   project and startup project — `StigviddAPI` cannot be the startup project, since it does not
   reference `Microsoft.EntityFrameworkCore.Design`:

   ```bash
   cd ..
   dotnet tool restore
   dotnet user-secrets set "ConnectionStrings:StigVidd" "your_connection_string" --project Infrastructure
   dotnet ef database update --project Infrastructure --startup-project Infrastructure
   ```

   The connection string is set a second time here on purpose: `Infrastructure` and `StigviddAPI`
   have separate `UserSecretsId` values, and the design-time factory
   (`Infrastructure/Data/DesignTimeDbContextFactory.cs`) reads the former.

5. Run the API:
   ```bash
   cd StigviddAPI
   dotnet run
   ```

The API listens on `http://localhost:5265` (the default `http` launch profile; use
`dotnet run --launch-profile https` for `https://localhost:7059` as well). In the Development
environment Swagger UI is available at `/swagger`. `/healthz` (liveness) and `/readyz`
(readiness, checks the database) are always on.

To run the backend tests, the connection string must be set even though the tests use SQLite
in memory — see [CLAUDE.md](CLAUDE.md) for the PowerShell and cmd forms:

```bash
cd backend
dotnet build
ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build
```

---

### Telemetry (optional)

The backend emits OpenTelemetry, and the app and admin web ship their logs to the same
place, but **only when it is configured** — with the variables below unset, no exporter
is registered, no log sink is installed, and nothing changes. To see your own traces and logs locally, run
the same OpenObserve image production uses:

```bash
docker run -d --name stigvidd-observatory \
  -p 5080:5080 -p 5081:5081 \
  -v stigvidd-observatory-dev:/data \
  -e ZO_DATA_DIR=/data \
  -e ZO_ROOT_USER_EMAIL=dev@stigvidd.se \
  -e 'ZO_ROOT_USER_PASSWORD=DevDev#123' \
  -e ZO_RUM_ENABLED=true \
  -e ZO_COMPACT_DATA_RETENTION_DAYS=3 \
  -e ZO_TELEMETRY=false \
  public.ecr.aws/zinclabs/openobserve:v0.92.2
```

UI at <http://localhost:5080>, same credentials. The password looks fussy because
OpenObserve enforces one: 8–128 characters with at least one lowercase, one
uppercase, one digit and one special character — a weaker value makes the
container *panic on startup* rather than warn.

Point the backend at it:

```bash
cd backend/StigviddAPI
dotnet user-secrets set "Otlp:Endpoint" "http://localhost:5080/api/default"
dotnet user-secrets set "Otlp:Username" "dev@stigvidd.se"
dotnet user-secrets set "Otlp:Password" "DevDev#123"
```

Username plus password is fine **here**, against a throwaway container. In production
the API takes `Otlp:Token` instead — an *ingestion token*, which is what OpenObserve's
**Ingestion** page prints and is already `base64("user:passcode")`:

```bash
dotnet user-secrets set "Otlp:Token" "<paste from the Ingestion page>"
```

The difference is not cosmetic. **OpenObserve OSS has no RBAC** — every account is an
admin — so the ingestion token is the only thing that scopes a credential to writing.
Measured on v0.92.2, for one and the same account: the token ingests but answers 401 on
`/_search` and `/users`, while the password reads every stream and creates admin users.
That is why nothing public may ever carry a password. See
[docs/notes/openobserve-oss-has-no-rbac.md](docs/notes/openobserve-oss-has-no-rbac.md).

The endpoint takes **no signal path** — the exporter appends `/v1/logs`,
`/v1/traces` and `/v1/metrics` itself.

For the app, point `EXPO_PUBLIC_OO_LOGS_URL` in `app/.env` at your machine's **LAN IP**
(not `localhost` — a phone or emulator resolves that to itself) and set
`EXPO_PUBLIC_OO_LOGS_TOKEN` to an ingestion token from the *Ingestion* page. Plain HTTP is dev-only: Android
blocks cleartext by default, and production is HTTPS through the proxy.

Tear down with `docker rm -f stigvidd-observatory` (add
`docker volume rm stigvidd-observatory-dev` to discard the data too).

**Host and container metrics** are a separate, opt-in piece: the `hostmetrics`
service in `docker-compose.yml` runs an OpenTelemetry Collector that reports the
machine's CPU, memory, load, disk, filesystem and network, plus per-container
CPU/memory from the Docker daemon. It sits behind a compose profile, so it stays
absent until `COMPOSE_PROFILES=hostmetrics` is set — see
[DEPLOYMENT.md](DEPLOYMENT.md) Part 1 step 8f. To try it locally against the
container above, add a `host@` user, copy its ingestion token, and:

```bash
COMPOSE_PROFILES=hostmetrics docker compose up -d hostmetrics
```

The first scrape lands 60 seconds after start, not immediately.

**Before adding any instrumentation**, read
[docs/observability.md](docs/observability.md) — metrics must contain no personal
data, and GPS positions must never be logged. Those are hard constraints, not
style preferences.

---

### Mobile App

1. Navigate to the app directory:

   ```bash
   cd app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with your API, Keycloak and MapTiler config:

   ```
   # The FULL base URL, scheme and path included — the app uses it verbatim.
   # On a device this must be your machine's LAN IP, not localhost.
   EXPO_PUBLIC_API_URL=http://10.0.0.2:5265/api/v1
   EXPO_PUBLIC_OIDC_URL=https://your-keycloak-host/auth
   EXPO_PUBLIC_OIDC_REALM=stigvidd
   EXPO_PUBLIC_CLIENT_ID=...
   EXPO_PUBLIC_MAPTILER_API_KEY=...
   EXPO_PUBLIC_MAPTILER_STYLE_ID=...

   # Telemetry (optional — omit and the app collects and sends nothing).
   # Copy the token from OpenObserve's Ingestion page while signed in as app@;
   # see the Telemetry section above. These ship inside the installed binary and
   # are therefore PUBLIC, which is exactly why the token must be an ingestion
   # token: a password would give anyone who unzips the APK full admin.
   EXPO_PUBLIC_OO_LOGS_URL=https://observatory.stigvidd.se/api/default/stigvidd_app_logs/_json
   EXPO_PUBLIC_OO_LOGS_TOKEN=...      # the app@ account's INGESTION TOKEN, never a password
   EXPO_PUBLIC_LOG_LEVEL=debug
   ```

4. Install a development build on your device or emulator — either build locally with
   `npx expo run:android` / `npx expo run:ios`, or install one made with
   `npx eas build --profile development`.

5. Start the development server (in its own terminal — it keeps running):
   ```bash
   npx expo start
   ```

6. Run the checks CI runs, plus the type check it does not:
   ```bash
   npm run format:check && npm run lint && npm test -- --watchAll=false
   npx tsc --noEmit
   ```

#### Builds and OTA updates read a different set of variables

EAS Build uploads your working tree, uncommitted and untracked files included, minus
whatever `.gitignore` excludes — and `app/.env` is git-ignored. A cloud build therefore sees
only the variables stored on EAS. Those are per environment, and the profiles in
[app/eas.json](app/eas.json) declare no `environment`, so eas-cli infers one — `preview`
for the preview profile, `development` for the dev client, `production` for a store build.

```sh
cd app
npx eas env:list --environment preview            # what a preview build will actually see
npx eas env:create preview --name EXPO_PUBLIC_FOO --value ... --visibility plaintext
npx eas update --branch preview --environment preview
```

The `--environment` flag on `eas update` is not optional in practice: without it the
bundle is built from **your local `.env`**, which is how a laptop's LAN address reaches
testers over the air. See
[docs/notes/eas-env-vars-are-not-your-dotenv.md](docs/notes/eas-env-vars-are-not-your-dotenv.md).

---

### Admin Dashboard

1. Navigate to the web directory:

   ```bash
   cd web
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with your API and Keycloak config:

   ```
   # The API origin only — the generated client appends /api/v1/... itself.
   VITE_API_URL=http://localhost:5265
   VITE_OIDC_URL=https://your-keycloak-host/auth
   VITE_OIDC_REALM=stigvidd
   VITE_CLIENT_ID=...

   # Telemetry (optional — omit both and the bundle installs no log sink and
   # makes no request). Copy the token from OpenObserve's Ingestion page while
   # signed in as web@; see the Telemetry section above.
   #
   # PUBLIC, and more exposed than the app's: Vite inlines VITE_* into a bundle
   # served from the web domain, so anyone can read this with one curl — no APK
   # to unpack. It must be an ingestion token; a password would hand every
   # visitor full admin over the observatory.
   VITE_OO_LOGS_URL=https://observatory.stigvidd.se/api/default/stigvidd_web_logs/_json
   VITE_OO_LOGS_TOKEN=...
   ```

   The tests never read this file — `vitest.config.ts` supplies its own values, so a
   real token here cannot leak into the suite. See
   [docs/notes/web-vitest-environment.md](docs/notes/web-vitest-environment.md).

4. Start the development server (in its own terminal — it keeps running):
   ```bash
   npm run dev
   ```

5. Lint, test and build. `npm test` is Vitest and type-checks nothing; `npm run build`
   (`tsc -b && vite build`) is the type check:
   ```bash
   npm run lint && npm test && npm run build
   ```

The API client under `src/api/generated` is generated by orval and must not be edited by hand.
It is generated from `web/openapi.json`, which is **not committed**: `OpenApiContractTests`
writes it on every backend test run. So run the backend tests once, then regenerate and commit
the client:

```bash
npm run generate:api
```

Jenkins runs the same command and fails if the committed client differs — GitHub Actions does
not, so a stale client passes a pull request and breaks on deploy. Generation reads that local
spec, so no backend needs to be running — but a checkout that has never run the backend tests has
no spec to read. Set `ORVAL_API_URL` to `http://localhost:5265/swagger/v1/swagger.json` to read
from a live API instead.

---

## Authentication

Authentication is handled by Keycloak. The mobile app and admin dashboard obtain a JWT from Keycloak on login (OpenID Connect), which is passed as a Bearer token in API requests. The backend validates incoming tokens against the Keycloak realm via `AddKeycloakWebApiAuthentication`.

---

## Data Source

Trail and facility data (grill sites, wind shelters) for the Borås area is sourced from [Borås Stad's open data portal](https://www.boras.se). Trails are kept in step through the trail-import review in the admin dashboard; see [docs/notes](docs/notes/) and `backend/Core/TrailImport/`.

---

## Documentation

Behavioural references — the *why* behind code that is easy to break:

| | |
| --- | --- |
| [docs/auth.md](docs/auth.md) | Sign-in, token refresh, email verification, the `AdminOnly` policy |
| [docs/map.md](docs/map.md) | MapLibre maps, location sources, every map screen |
| [docs/record-hike.md](docs/record-hike.md) | Recording a hike: segments, the GPS filter, background engines |
| [docs/spatial-data.md](docs/spatial-data.md) | PostGIS storage, SRID 4326, the wire format |
| [docs/media-upload.md](docs/media-upload.md) | Image processing and WebDAV storage |
| [docs/push-notifications.md](docs/push-notifications.md) | Expo push, registration and delivery |
| [docs/mail.md](docs/mail.md) | Mail templates and the outbox |
| [docs/moderation.md](docs/moderation.md) | Content reports and the moderation queue |
| [docs/observability.md](docs/observability.md) | Telemetry, retention and GDPR constraints |
| [DEPLOYMENT.md](DEPLOYMENT.md), [STAGING.md](STAGING.md) | Running the stack on a host |

[docs/notes/](docs/notes/INDEX.md) holds shorter, measured facts — one gotcha per file.
[CLAUDE.md](CLAUDE.md) is the contributor guide: which command answers which question, and
what CI does and does not check.

---

## Licence

Stigvidd is free software. It is **not** under a single licence, because the two halves ship
through different channels and one of those channels will not accept copyleft of the strongest
kind.

| Part | Licence | |
| --- | --- | --- |
| `backend/` — REST API | **AGPL-3.0-or-later** | [text](LICENSES/AGPL-3.0-or-later.txt) |
| `web/` — admin dashboard | **AGPL-3.0-or-later** | [text](LICENSES/AGPL-3.0-or-later.txt) |
| `app/` — mobile app (Android + iOS) | **MPL-2.0**, Exhibit B not applied | [text](LICENSES/MPL-2.0.txt) · [why](app/LICENSE.md) |

Every file says which of the two it is under, as an `SPDX-License-Identifier` header. Files
that cannot carry one — generated code, EF migrations, binaries — are covered by
[`REUSE.toml`](REUSE.toml). The repository follows the
[REUSE](https://reuse.software) specification, and CI checks that it still does.

### The backend and admin web are AGPL

They are two halves of one network service, which is exactly the case the GNU Affero GPL
exists for: ordinary GPL copyleft reaches people you hand a binary to, and a hosted service
hands out no binaries. AGPL § 13 closes that.

### The app is MPL-2.0, and keeps the GPL option open

Android and iOS are built from one codebase, so the licence has to satisfy the stricter store.
Apple's App Store terms impose DRM and per-account device limits, which GPLv3/AGPLv3 § 6
forbids imposing on a recipient — the conflict that pushed VLC's iOS port off the GPL.

MPL-2.0 is compatible with store distribution. Crucially, **Exhibit B is deliberately not
applied**, so the Secondary Licenses in MPL-2.0 § 1.12 stay available: anyone who wants this
code under GPL-2.0-or-later, LGPL-2.1-or-later or AGPL-3.0-or-later may take it on those terms
instead. See [`app/LICENSE.md`](app/LICENSE.md) — and do not add an Exhibit B notice.

### Source for the running service

AGPL § 13 entitles everyone who interacts with a deployed Stigvidd server to its Corresponding
Source. This repository is that source: <https://github.com/themalind/stigvidd>. The admin
dashboard and the mobile app both link to it from their About screens, and the API advertises
it in its OpenAPI description.

### Third-party components

Dependencies keep their own licences, listed in
[`backend/THIRD-PARTY-NOTICES.md`](backend/THIRD-PARTY-NOTICES.md),
[`web/THIRD-PARTY-NOTICES.md`](web/THIRD-PARTY-NOTICES.md) and
[`app/THIRD-PARTY-NOTICES.md`](app/THIRD-PARTY-NOTICES.md). Nothing in the tree is non-free.

Map data is OpenStreetMap under **ODbL 1.0**, served by MapTiler; the attribution is rendered
on every map screen and is not optional. Trail and facility data comes from Borås Stad's open
data portal under **CC0 1.0**, a public domain dedication that requires no attribution — the
credit given to Borås Stad is a courtesy, and only the ODbL one is an obligation.

Copyright © 2025-2026 The Stigvidd Authors. The individual copyright holders are listed
in [`AUTHORS`](AUTHORS) — relicensing any part of this project needs the agreement of all
of them, since there is no CLA and no copyright assignment.
