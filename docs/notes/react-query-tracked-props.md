# React Query notifies only about result fields read *during render* — a test probe that reads `.data` afterwards sees a stale value, silently

`useQuery` does not return its result object. With `notifyOnChangeProps` unset — which is
every hook in `app/src` — it returns a **Proxy** over it, and every property read through
that Proxy is recorded. The observer then re-renders only when one of the **recorded** fields
changes. Measured against `@tanstack/react-query` 5.90.11, in
[`queryObserver.js`](../../app/node_modules/@tanstack/query-core/build/modern/queryObserver.js):

```js
trackResult(result) {                       // useBaseQuery.js:99 wraps every result in this
  return new Proxy(result, { get: (target, key) => { this.trackProp(key); ... } });
}
// ...
if (notifyOnChangePropsValue === "all" || (!notifyOnChangePropsValue && !this.#trackedProps.size)) {
  return true;                              // notify unconditionally
}
return Object.keys(this.#currentResult).some(
  (key) => this.#currentResult[key] !== prevResult[key] && includedProps.has(key),
);
```

In an app component this is invisible: a component that renders `data` has read `data` during
render, so it is tracked, so it re-renders. It bites a **test probe** — a component that
assigns the whole result to an outer variable and returns `null`, with the assertions reading
the fields afterwards.

## Why the wrong model looks right

Two things make this read as something else entirely.

**Reading nothing is safe; reading one field is not.** The guard above is
`!notifyOnChangePropsValue && !trackedProps.size` — an observer that has tracked *nothing* is
notified about *everything*. So a bare `function Probe() { result = useThing(); return null; }`
works. Add a `flushUntil(() => result.isSuccess)` helper and it stops working, because
`isSuccess` is now the only tracked field and a data-only change no longer notifies. The
probe got **more** fragile by being waited on more carefully.

**The first change usually lands.** `pending → success` moves `status`, `isSuccess`,
`isPending` *and* `data` together, so whatever the probe happens to read is among them. The
failure only appears on a **second, data-only** transition — a `setQueryData` from elsewhere,
or a refetch that returns a different value at the same status. Which is why this surfaces as
"the refetch didn't work" rather than as a test-harness problem.

**`#trackedProps` is a Set that is never cleared**, so a field read in an assertion at tick T
is tracked from T+1 onward. The same test can pass or fail on the ordering of its own
assertions.

The symptom, when it does bite: `queryClient.getQueryData(key)` holds the **new** value while
the probe's captured result still holds the **old** one, with no warning, no `act()` complaint
and no failed flush — the flush loop simply runs out of ticks against a predicate that will
never come true. That is what makes it cost an hour: every visible signal says the query
worked, because it did.

## What this repo does about it

`renderWithProviders` in [`app/src/test/render.tsx`](../../app/src/test/render.tsx) sets
`notifyOnChangeProps: "all"` on the client's query defaults. That is a truthy value, so
`useBaseQuery` skips `trackResult` altogether — no Proxy, no tracking, every observer notified
on every change. Probes can then be written the obvious way.

It only ever makes a test render **more** often than production would, so it cannot hide a
correctness bug — only the render-count optimisation, which nothing here asserts. Verified by
flipping it on and off across the whole app suite: 111 suites / 1879 tests pass either way,
and the probe in
[`useUserLocation-permission.test.tsx`](../../app/src/hooks/__tests__/useUserLocation-permission.test.tsx)
fails without it and passes with it.

Three other escapes, if the default is ever not wanted:

| escape | cost |
| --- | --- |
| read the asserted fields during render (`void query.data;`) | ritual that reads as dead code and gets deleted by the next person |
| assert `queryClient.getQueryData(key)` instead of the hook result | proves the cache, not that the hook surfaces it |
| assert through rendered output rather than a probe | only possible when there is a component to render |

Setting `notifyOnChangeProps` on the *hook* would fix it too, and is wrong: it changes
production behaviour to suit a test.

Related: [[app-component-testing-what-layout-can-be-asserted]] for the rest of what a
`jest-expo` render can and cannot answer.
