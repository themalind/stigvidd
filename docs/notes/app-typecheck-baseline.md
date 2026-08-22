# `npx tsc --noEmit` in app/ has 19 pre-existing errors, and no CI job runs it

Nothing type-checks `app/`. [.github/workflows/ci.yml](../../.github/workflows/ci.yml)'s
`app` job runs `prettier --check`, `expo lint` and `jest`, and the Jenkinsfile does not touch
`app/` at all. So the first session to run

```sh
cd app && npx tsc --noEmit
```

gets a wall of errors and no way to tell whether it caused them. Measured at
`0e1a99e` + the agent-harness merge: **19 errors, exit 2, all of them in
`src/**/__tests__/*.ts`** — no production file is affected.

| count | code | cause |
| --- | --- | --- |
| 16 | `TS2304: Cannot find name 'global'` | `app/tsconfig.json` sets `"types": ["jest", "geojson"]`, which **replaces** the default type roots, so `@types/node` is not loaded and the Node `global` identifier is unknown. A configuration gap, not broken code — the fix is adding `"node"` to that array, or using `globalThis` in the tests. |
| 3 | `TS2345` in `src/services/__tests__/logger.test.ts` | genuine: a `(value: unknown) => void` passed where `() => void` is expected. |

Affected files: `src/api/__tests__/{auth,friends,hikes,shared-hikes,trails}.test.ts`,
`src/services/__tests__/{keycloak-auth,logger}.test.ts`.

**Use the number as a baseline.** 19 means you added none; 20 means you added one. Jest does
not see any of this — `jest-expo` transpiles via Babel and does not type-check — so a real
type error in app *production* code is currently caught by nothing at all, which is the
reason to run the command deliberately rather than the reason to ignore its output.

Related: [[agent-harness-hooks]].
