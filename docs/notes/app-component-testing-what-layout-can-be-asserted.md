# In app/ jest tests, style is assertable and geometry is not — `onLayout` never fires

Component tests under `jest-expo` render through `react-test-renderer`. **Yoga does not run.**
Measured with a probe: a `View` with `onLayout` never receives the event, so every layout
number stays at its initial value and `measure()` has nothing to report.

So the questions that can be answered are about the *style contract*, not the rendered result:

| assertable | not assertable |
| --- | --- |
| `toHaveStyle({ flex: 1, gap: 8, borderRadius: SURFACE_BORDER_RADIUS })` — `StyleSheet` values, flattened out of arrays | where anything actually lands, in px |
| theme colours in both themes, by passing `theme: AppDarkTheme` to `renderWithProviders` | whether two elements overlap |
| `numberOfLines`, `maxWidth: "70%"`, `flexShrink` — the rules that make text truncate | whether the text *did* truncate |
| element order in the tree, conditional rendering, `pointerEvents` | anything needing a screen: use Maestro/Detox on a device |

That is not as thin as it sounds: the three layout bugs fixed on 2026-08-31 were each a wrong
*rule* — a missing `flex: 1` that let a long menu label run under its badge, a hardcoded
`borderRadius: 20` where the shared token is 5, a `textColor` with no fallback that drew
near-black text on the dark theme's dark surface. All three are caught by `toHaveStyle`, and
all three were verified to fail when reintroduced.

## react-native-paper hands your style to elements you did not name

Paper splits a component into a `Surface` of several layers and **derives testIDs**, so the
style you passed is rarely on the element carrying the testID you set:

| you set | your `style` lands on |
| --- | --- |
| `<Button testID="x">` | layout (`width`, `flex`) on `x-container-outer-layer`; colour and `borderRadius` on `x-container` |
| `<Dialog testID="x">` | `x-surface` (with `x-surface-outer-layer` above it) |
| `<Modal>` | `modal-surface`, whatever you called it |
| `<TextInput testID="x">` | `x` is the inner native input; the styled root has no testID — put one on the wrapping `View` instead |

Find the right handle by dumping `StyleSheet.flatten(el.props.style)` for each candidate id
rather than guessing; a `toHaveStyle` against the wrong layer fails with the expected key
simply absent.

Icons are mocked repo-wide ([app/\_\_mocks\_\_/@expo/vector-icons.js](../../app/__mocks__/@expo/vector-icons.js)),
so an icon is `getByTestId("icon-<name>")` — the real sets load a font asynchronously and
`setState` outside `act()`, which printed a warning in every test that drew one.

**Paper's own `<Icon source="x">` is a different matter.** It renders with a derived
`icon-x` testID all the same, but marks itself `accessibilityElementsHidden` /
`importantForAccessibility="no-hide-descendants"` — and every query skips hidden elements by
default, so `queryByTestId("icon-map-marker")` answers `null` for an icon that is plainly
there in `screen.debug()`. Pass `{ includeHiddenElements: true }`. Asserting a Paper icon is
*absent* without it is the dangerous direction: the assertion holds whether the icon renders
or not, which is how a mutation removing the condition around it survives.

Related: [[jotai-query-atom-builds-its-own-queryclient]], [[app-typecheck-baseline]].

## Driving the tree: flush with `act`, not `waitFor`

`waitFor` costs about **900 ms per call** in this setup — measured against a condition that
an `await act(async () => {})` satisfies in 15 ms — which puts it within a coin flip of its
own one-second default. A suite built on it goes from green to red and back with nothing
changed: `share-hike-modal.test.tsx` failed five of nine tests that way and passed the same
five on the next run, and `login-screen.test.tsx` took 5.5 s for nine assertions.

For a state change that has *already been triggered* (a press, a `changeText`, a resolved
mock), flush instead:

```ts
fireEvent.press(screen.getByText("Nästa"));
await act(async () => {});   // validation and the query resolve on microtasks
```

Both suites became deterministic and roughly ten times faster. Keep `findBy*`/`waitFor` for
what is genuinely still in flight and has no other signal.

**And flush between interactions, not just before assertions.** The element a query hands
back carries the closure of the render it came from, so firing a second event before the
first re-render commits runs against stale values: in `trail-obstacle-form.test.tsx`, typing
a description and then flipping the location switch made the switch see the trail geometry as
still unloaded and answer "du verkar inte befinna dig på leden" — with the geometry sitting in
the query cache the whole time.

## Four more things the environment decides for you

- **`Platform.OS` is `"ios"`** under the `jest-expo` preset. Anything with an Android branch
  is therefore untested by default — `SelectInput` renders a native `Picker` whose options no
  query can reach, while Android renders pressable rows that are trivial to drive. Assign
  `Platform.OS = "android"` (writable at runtime, and the types now allow it) around the block
  that needs it. What this does **not** reach is a `Platform.select` inside a
  `StyleSheet.create`: that resolves once, when the module is first imported, so a style
  branch chosen there keeps the iOS value however the flag is set afterwards. Only the
  branches read during render — `BackButton`'s `Platform.OS !== "ios"` guard, say — respond.
- **`getByTestId(x).parent` is not a host element**, and `toHaveStyle` rejects it with
  *"received value must be a host element"* and a dump of a fiber. Composite components sit
  between every pair of hosts, so the parent of a `View` is usually the function that rendered
  it rather than the enclosing `View`. Give the wrapper its own `testID` instead of walking up
  to it.
- **An ESM-only dependency must be listed in `transformIgnorePatterns`** in `app/package.json`,
  or every suite that imports it dies at load with `SyntaxError: Cannot use import statement
  outside a module` — pointing at your own test file, not at the package.
  `@miblanchard/react-native-slider` and `jotai-tanstack-query` are there for this reason.

## A component that measures itself renders nothing at all

`measureInWindow` **exists on a host ref and never calls back** — no layout runs, so there is
nothing to report and no error either. Anything gated on that callback is therefore dead in a
test: `list-header-actions.tsx` sets its sort menu's position inside it and only then flips
`sortOpen`, so the whole popover — every sort row, the direction arrow, the "more filters"
hand-off — simply never appears, and a test written against it fails with "unable to find",
pointing at the menu rather than at the measurement.

Every host instance shares one prototype, so patching it once covers everything the test
renders afterwards. [`app/src/test/measure.tsx`](../../app/src/test/measure.tsx) does that
(`stubMeasureInWindow()`, with a `restore()` for `afterAll`), which is what made those
thirteen assertions possible. The same applies to `onLayout`-driven state, except there the
event can be fired directly:
`fireEvent(el, "layout", { nativeEvent: { layout: { height: 150 } } })`.

A camera move is the same kind of invisible: `cameraRef.current?.easeTo(...)` leaves nothing
in the rendered tree. The MapLibre mock therefore records every imperative handle it hands
out, reachable through [`app/src/test/maplibre.ts`](../../app/src/test/maplibre.ts) —
`cameraHandles().at(-1)` is the camera of the tree rendered last, and `resetMapHandles()`
belongs in `beforeEach`, since handles outlive the render that made them. Import them from
that helper and not from `@maplibre/maplibre-react-native`: the extras exist only on the
mock, so importing them from the package does not type-check.

## Mocking an atomFamily: cache per key or React stops the render

A `jest.mock` factory standing in for `userSearchAtomFamily` that builds a fresh atom per
call subscribes a new atom on every render, which React ends as **"Maximum update depth
exceeded"** — reported from deep inside `react-native-paper`'s `PortalManager`, not from the
mock. The real family caches by key, so the mock has to as well: keep a `Map` and clear it in
`beforeEach`.

The same shape of trap sits in `screen`'s own queries: `queryByText` **throws when two
elements match**, so waiting on a string that appears twice in some states (the friends
screen labels both its title and its failed section "Vänner") fails the wait rather than
timing it out. Wait on something unique — a placeholder, a testID.

## Two things `screen` cannot see — and what handles them now

**A raw string under a non-`Text` host is invisible to `queryByText`.** `{list.length && <X/>}`
renders the number `0` when the list is empty, and the tree that comes back is
`{"type":"View","children":["0"]}` — which on a device is React Native's *"Text strings must be
rendered within a `<Text>` component"* red box, and in a test is nothing at all:
`queryByText("0")` returns null and the suite stays green. `trail-obstacle-update-form.tsx` had
exactly that on its category picker (`issueTypes?.length &&`, fixed to `!!issueTypes?.length &&`).

Since that is a whole class of bug that no assertion anyone forgets to write will catch, it is
checked for **every test, automatically**: [`app/jest.after-env.js`](../../app/jest.after-env.js)
walks the last rendered tree after each test and fails it with the offending string and the host
path leading to it. Two constraints shape that file, and breaking either makes it silently do
nothing:

- It must be declared **before** `@testing-library/react-native` is imported anywhere, because
  `afterEach` hooks run in declaration order and the library declares its own cleanup on import;
  after that cleanup `screen.toJSON()` throws and there is no tree left to inspect.
- For the same reason it must not import the library at all — a *first* import during a run
  registers that cleanup hook inside a test, and Jest fails every test in the file with "Hooks
  cannot be defined inside tests". So `renderWithProviders` hands the tree over instead, through
  `rememberRender`/`takeRender` in [`app/src/test/tree.ts`](../../app/src/test/tree.ts).

`strayText` is exported from that module for a test that wants to name the case explicitly.

**Its mirror image is an `<Text />` with nothing in it**, which the guard does not catch and no
query can find either. `{value ? <Text>{t(value)}</Text> : null}` mutated to drop the condition
renders an empty `Text`, and every text assertion still passes — but the column laying those
blocks out with `gap: 20` gives the empty one a slot all the same, so the device shows 20 px of
blank space. Where a suite asserts that an absent field renders *nothing*, assert that too:
filter `screen.UNSAFE_queryAllByType(Text)` for a node whose `props.children` is
`undefined`, `null` or `""` and expect none
(`app/src/components/area/__tests__/area-detail-screen.test.tsx`). Two mutations survived
without it.

**A dismissed Paper `Dialog` is still in the tree.** It unmounts when its exit animation ends,
not when the state that hid it changes, so `expect(queryByText(title)).toBeNull()` on the next
line fails — while the same assertion passes for a `Modal` whose `visible` prop was `false` from
the first render. Flushing until it goes *appears* to work and is a trap: the animation is 220 ms
of wall-clock time, so whether it lands depends on how long the test's other work happened to
take.

`renderWithProviders` therefore hands `PaperProvider` the theme with `animation.scale: 0` —
Paper multiplies every duration by it — which makes the exit land on the tick after the state
change. `flushUntilGone(() => screen.queryByText(title))` from
[`app/src/test/flush.ts`](../../app/src/test/flush.ts) then settles in two ticks, and "the
dialog closed" is an assertion again. The theme handed to the component under test is unchanged,
so colour assertions still see the real palette.

## A query that outlives the test hangs the whole run

Both of these leave a suite **passing** and the Jest worker alive, so the run sits at
"Jest did not exit one second after the test run has completed" long after the last
assertion — and `--detectOpenHandles` names neither, because running in band changes the
timing enough to hide them:

- **A hook that sets its own `gcTime`.** `renderWithProviders` builds its client with
  `gcTime: 0`, but a hook's own options win: `useTrails` asks for 24 hours, so every test
  that renders it leaves a day-long garbage-collection timer behind.
  [`app/jest.after-env.js`](../../app/jest.after-env.js) now disposes every client
  `renderWithProviders` built — in the *next* test's `beforeEach` rather than an
  `afterEach`, because that hook is declared ahead of the library's cleanup and clearing a
  cache under a still-mounted tree re-renders it outside `act()`.
- **A fetch still in flight when the test ends.** `mockReturnValue(new Promise(() => {}))`
  is the ordinary way to hold a screen in its loading state, and clearing the client does
  *not* dispose it. Hand the mock a promise you resolve yourself and land it before the test
  returns — the assertions about the loading state have already run by then.

The two are independent: fixing only one still hangs.

## `field.onChange` returns a Promise, so `act(() => …)` around it silently does nothing

Driving a react-hook-form field by calling its handler directly — the only way to reach a widget
that renders no host element you can `fireEvent` on, such as `react-native-star-rating-widget` —
has to be done inside an **awaited async** `act`:

```ts
await act(async () => {
  widget.props.onChange(4);          // field.onChange from a Controller
});
```

`act(() => widget.props.onChange(4))` looks equivalent and is not: RHF's `onChange` returns a
promise (it kicks off validation), React sees the callback return a thenable, decides it is an
async act that was never awaited, prints *"You called act(async () => ...) without await"* as a
`console.error` — which no test fails on — and drops the update. The field keeps its old value.

`add-review-form.test.tsx` set the rating that way and passed all the same: the component also
mirrored the rating into local `useState` and submitted *that*, so the assertion was true about
the copy while the form value never moved. Removing the mirror turned every test in the file red
at once and the missing `await` was the whole reason. `fireEvent` is unaffected — it awaits its
own act internally — so this only bites when calling a prop by hand.
