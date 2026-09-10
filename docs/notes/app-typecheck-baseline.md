# `npx tsc --noEmit` in app/ has no fixed baseline — the count depends on a gitignored generated file

Nothing type-checks `app/`. [.github/workflows/ci.yml](../../.github/workflows/ci.yml)'s
`app` job runs `prettier --check`, `expo lint` and `jest`, and the Jenkinsfile does not touch
`app/` at all. `jest-expo` transpiles via Babel and does not type-check either, so a type
error in app **production** code is currently caught by nothing — which is the reason to run

```sh
cd app && npx tsc --noEmit
```

deliberately, and the reason this note exists.

## The count is not a property of the repo

The obvious use of that command is a baseline: run it, remember the number, treat any
increase as yours. **That does not work here**, and the reason cost a session.

`app/tsconfig.json` extends `expo/tsconfig.base`, and expo-router contributes the typed-route
union — the `Href` type every `router.push()` and `<Link href=...>` is checked against — from
**`.expo/types/router.d.ts`**. That file is *generated* by the Expo CLI, and
[`.gitignore:19`](../../.gitignore#L19) ignores the whole `.expo/` directory. So it is not in
the repo, it is not in CI, and on any given checkout it reflects whenever that machine last
ran the dev server.

When it lags the route tree, `tsc` reports routes that exist on disk as invalid. Measured on
this checkout, 2026-09-05 — **2 errors, exit 2**:

| file | code | route it rejects |
| --- | --- | --- |
| `src/components/shared-hike/shared-hike-details.tsx:88` | `TS2820` | `/(tabs)/(profile-stack)/hike-follow/[identifier]` |
| `src/components/trail/trail-creator/hike-details.tsx:74` | `TS2322` | `/(tabs)/(home)/hike-follow/[identifier]` |

Both routes exist and are committed (`8dfdd7f`, 2026-08-31):
`src/app/(tabs)/(home)/hike-follow/[identifier].tsx` and its `(profile-stack)` twin. The
local `.expo/types/router.d.ts` was dated **2026-07-04** — six weeks older than the routes —
and contains no `hike-follow` at all. `tsc` is reporting a stale artifact, not broken code.

TypeScript's hint actively points the wrong way here: it suggests
`Did you mean '.../follow/[identifier]'?`, but `follow/` and `hike-follow/` are two different
screens that both exist. Taking the suggestion would silently change which screen the app
navigates to.

## How to read the output

Regenerate before believing a number. The Expo CLI rewrites `.expo/types/router.d.ts` when
the dev server starts — and that is a foreground-wedging command, so background it
(`.claude/hooks/guard-long-running.mjs` denies it otherwise). Then re-run `tsc`.

The sequence that means something is: regenerate, run `tsc`, note the count, make the change,
run `tsc` again. A number carried over from an earlier session, from this note, or from
[INDEX.md](INDEX.md) is **not** a baseline — this note has recorded 19, then 0, then 2, and
none of those was wrong when it was written.

The earlier `19` was a different cause, since resolved: `tsconfig.json`'s
`"types": ["jest", "geojson"]` replaces the default type roots, so `@types/node` was not
loaded and 16 `TS2304: Cannot find name 'global'` errors landed in `src/**/__tests__/*.ts`.
That array is unchanged, but `expo-env.d.ts` now reaches `expo/types/global.d.ts` and the
identifier resolves. Only 3 of that 19 were ever real.

Related: [[agent-harness-hooks]], [[eas-env-vars-are-not-your-dotenv]].
