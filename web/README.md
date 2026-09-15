# Stigvidd — admin dashboard

The web admin for Stigvidd: trails, facilities and media, the Borås trail-import review,
the moderation queue, mail templates and environment migration. React 19, Vite, Tailwind v4
and TanStack Query. Licensed **AGPL-3.0-or-later**. Every route needs the `stigvidd-admin`
realm role — see [docs/auth.md](../docs/auth.md).

Setup and the `.env` variables are in the [root README](../README.md#admin-dashboard). The
short version:

```bash
npm ci
npm run dev                 # keeps running
```

Use Node 22 or 24 — on Node 26 every test fails in shared setup
([note](../docs/notes/node-26-shadows-jsdom-localstorage.md)).

## Checks

```bash
npm run lint
npm test                    # Vitest, config in vitest.config.ts; type-checks nothing
npm run build               # tsc -b && vite build — this is the type check
```

One file: `npx vitest run <path>`. Tests read their environment from `vitest.config.ts`,
never from your `.env`.

## The generated API client

`src/api/generated/` is produced by orval from `openapi.json` and must not be edited by hand.
`openapi.json` is gitignored — the backend test run writes it — so run the backend tests
first, then:

```bash
npm run generate:api
git diff --exit-code -- src/api/generated
```

Commit the result. Only Jenkins checks that the committed client is current; GitHub Actions
does not. To generate from a running API instead, set `ORVAL_API_URL`.

## Layout

| | |
| --- | --- |
| `src/pages/` | One folder per sidebar section; admin tools under `pages/admin/` |
| `src/components/` | UI, including the shared `ui/` primitives |
| `src/lib/` | Logic extracted from large components so it can be tested (`trail-import-review.ts`, `moderation-review.ts`, `mail-template.ts`, `media-upload.ts`, …) |
| `src/api/` | The generated client plus the hand-written `mutator.ts` and `admin.ts` |
| `src/services/` | Keycloak sign-in and telemetry |
| `src/router/` | Routes |
