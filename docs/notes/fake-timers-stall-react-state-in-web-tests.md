# vi.useFakeTimers() leaves a web component stuck on its first render, so drive polls by capturing setInterval

**Symptom.** A polling test for
[media-reprocess-jobs.tsx](../../web/src/components/media/media-reprocess-jobs.tsx)
(2026-09-28) called `vi.useFakeTimers()`, rendered, and ran `await vi.advanceTimersByTimeAsync(0)`
and then `(9000)`. The mocked `getMediaReprocessJobs` had been called once and its promise had
resolved, but `document.body.textContent` was still `Loading…`. The poll interval was never
registered, so the test saw 1 call where it expected 2.

**Why it looks like something else.** A single call with the component stuck on loading reads
as a mock problem. The first guess was that `mockReturnValue(new Promise(() => {}))` was winning
over `mockResolvedValueOnce`. The second rewrite swapped in
`mockImplementation(...).mockResolvedValueOnce(...)`. Neither helped, because the mock was fine:
even a counter-based `mockImplementation` that resolved on call 1 still left the component on
`Loading…`. The resolved value never became a React commit under fake timers.

The mechanism wasn't isolated. React's scheduler likely runs on a timer primitive that Vitest
fakes, but that is inference, not measured. A sibling test with the same setup ("toasts a
failing poll once") passed only because it asserted `>= 4` calls in the full run, so it proved
nothing either.

**What works.** Keep real timers and capture the interval instead:

```ts
const ticks: (() => void)[] = [];
const spy = vi.spyOn(globalThis, "setInterval").mockImplementation(((fn: () => void) => {
  ticks.push(fn);
  return 1;
}) as unknown as typeof setInterval);
render(<MediaReprocessJobs refreshKey={0} />);
await screen.findByText("0/2 succeeded"); // the real first load has committed
ticks.at(-1)?.(); // one poll tick, run by hand
spy.mockRestore();
```

This is deterministic, needs no timer advancing, and still exercises the component's real
`setInterval(poll, POLL_MS)` wiring.

**The same trap for negative assertions.** A race test ("a slow answer for job A must not fill
job B's failures panel") passed even with the guard deleted. The test resolved A's deferred
promise, awaited it, and asserted `queryByText("Reason A")` was null. That assertion ran before
React committed the stray update. Wrapping the resolve in
`await act(async () => { slowA.resolve(...); await slowA.promise; })` flushes the update, and
only then did the unguarded version fail. A "must not appear" assertion after an async state
change needs `act`, or it is vacuous (skill `prove-it-bites`).

Related: [[web-vitest-environment]], [[node-26-shadows-jsdom-localstorage]].
