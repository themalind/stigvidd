# A jotai-tanstack-query atom builds its own QueryClient unless `queryClientAtom` is seeded, and its 5-minute gcTime holds Jest open

Mounting anything that reads `stigviddUserAtom` — `ShareHikeModal`, and through it
`HikeDetails` — left `npx jest <one file>` printing *"Jest did not exit one second after the
test run has completed"* and then sitting there for five minutes. Every test passed. The full
`npm test` run hid it: with several suites Jest runs in workers and force-exits them, printing
only *"A worker process has failed to exit gracefully"*, so the cost showed up as a warning
rather than as a hang.

`--detectOpenHandles` reports **nothing**, which is the misleading part: there is no socket
and no leaked handle. It is a `setTimeout`, held by a cache nothing in the test ever asked for.

## The mechanism

`atomWithQuery` / `atomWithMutation` read `queryClientAtom` (jotai-tanstack-query). That atom
**defaults to a `new QueryClient()` of its own** — not the one under `QueryClientProvider`.
Rendering a query atom therefore creates a second client with stock defaults, including
`gcTime: 5 * 60 * 1000`, and its garbage-collection timer keeps Node's event loop alive for
exactly 300 s after the last assertion.

`src/app/_layout.tsx` sets the atom (`useSetAtom(queryClientAtom)`) so the real app never has
two clients. A test harness that mounts `QueryClientProvider` and a jotai `Provider` without
also seeding the atom does — and gets a second cache the assertions cannot see, which is the
same bug wearing a different hat.

The fix is one line in [app/src/test/render.tsx](../../app/src/test/render.tsx):

```ts
store.set(queryClientAtom, queryClient);
```

Confirmed by bisection: a test rendering only a component that reads `stigviddUserAtom` hung;
with the atom seeded the same test exits in 3 s. `gcTime: 0` on the *provider's* client does
nothing about it, because that client was never the one holding the timer.

Related: [[app-component-testing-what-layout-can-be-asserted]].
