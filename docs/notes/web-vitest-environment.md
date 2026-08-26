# The web test environment substitutes two things quietly: Blobs and `.env`

`web/` runs Vitest over jsdom. Two of its defaults hand the code under test something other
than what a browser would, and neither says so — one produces a wrong assertion, the other
points tests at a live server.

## A jsdom Blob does not survive `structuredClone`, so IndexedDB loses the bytes

`fake-indexeddb` stores whatever the global `structuredClone` gives it, and under Vitest's
jsdom environment that global is **Node's**, not jsdom's (measured: its source is Node's,
throwing `ERR_MISSING_ARGS`). Node's `structuredClone` does not recognise a jsdom `Blob`, and
rather than raising `DataCloneError` it treats it as a plain object and returns `{}`.

Measured, writing `[{ blob: new Blob(["x"]) }]` into fake-indexeddb and reading it back:

| | put | get |
| --- | --- | --- |
| jsdom `Blob` | succeeds | `[{ blob: {} }]`, and `blob instanceof Blob` is **false** |
| Node `Blob` (`node:buffer`) | succeeds | a real `Blob`, `await .text()` === `"x"` |

So `staged-media.ts`'s `isStagedFile` — which tests `blob instanceof Blob` — filtered every
staged file out, and `loadStagedFiles()` returned `[]` while the code was correct. A real
browser stores Blobs in IndexedDB; this is the fake plus the environment, not the code.

`staged-media.test.ts` therefore installs Node's `Blob` and `File` over jsdom's — **at the top of
that one file, not in `src/test/setup.ts`**. Doing it globally is the trap: jsdom's
`FormData` does not recognise a Node `File` either, and rather than refusing it appends the
string `"[object File]"`. Every multipart upload path — `addTrailImages`,
`setTrailSymbol`, `createSession` in `trail-import.ts`, the media upload — then sends
fields where it should send files, and does so only under test, where nothing is watching.
Measured, after the global override was in place: `formData.get("symbol")` came back as a
string. Vitest isolates each test file's environment, so the override is confined to the
one module that needs it.

Node's `File` also degrades to a `Blob` across a clone (losing `name` and `lastModified`),
which does not matter for `staged-media.ts` because it stores those as its own fields.

## `test.env` in `vitest.config.ts`, not `web/.env`

`services/keycloak-auth.ts` reads `VITE_OIDC_URL` / `VITE_OIDC_REALM` / `VITE_CLIENT_ID` at
**module load**, into `REALM_BASE`. Vitest otherwise loads the developer's own `web/.env`,
whose values are the real `https://inkaben.se/auth` realm — so the token tests would build
their endpoints from it, and a stubbed `fetch` is the only thing between the suite and a live
Keycloak. `test.env` in `vitest.config.ts` overrides `.env`; the mutator test asserting
`https://api.test/...` is what proves the override still holds.

Because those constants are captured at import time, a test that needs different module
state has to `vi.resetModules()` and re-import — `keycloak-auth.test.ts`'s `loadAuth()`. The
module also caches the access token, its expiry and the refresh token in module scope, so
without that a token minted in one test is the cache hit in the next.

## Two smaller ones

- The config is **`web/vitest.config.ts`, deliberately not `vite.config.ts`** — the runner
  never gets loaded by `vite build`, so a broken test config cannot break the bundle. The `@`
  alias is duplicated there; that is the whole cost.
- **`vitest` watches by default**; `vitest run` is the form that exits. There is no TTY in a
  tool call, so the watcher does not even redraw — the turn just sits until it times out.
  `guard-long-running.mjs` denies the watch forms (including `npm run test:watch`) and lets
  `vitest run`, `--run`, `list` and `bench --run` through.

## What the suite is worth

336 tests over 17 files. The first four cover `api/mutator.ts`, `services/keycloak-auth.ts`,
`lib/staged-media.ts` and `api/image-options.ts`; the rest cover the surfaces that can change
the database most — the **trail-import review**, the **migration page**, the **trail editor**
and the **media upload**.

Proved by mutation five times over: 15 mutations of the first group, **14 caught**; 21 of the
import review, **21 caught**; 32 of the admin/auth group, **32 caught**; 71 of the geometry,
media-rules, editor and proposal-detail group, **69 caught**; 29 of the media-upload
component, **28 caught**. The four survivors are equivalent mutants rather than gaps, and
each for a reason worth knowing:

- Removing `204, 205` from mutator.ts's no-body list still yields `undefined`, because
  `response.text()` returns `""` and `body ? JSON.parse(body) : undefined` already falls
  through. `304` in the same list is unreachable for a different reason: `Response.ok` is
  false outside 200–299, so a 304 throws in `errorMessage` before it is consulted.
- Deleting `pixelsPerMetre`'s `if (!size.w || !size.h) return 0` changes nothing, because
  `Math.min(size.w / view.w, size.h / view.h)` is already 0 when either side is 0 — and
  `view.w`/`view.h` are never 0 (`boundsOf` floors both at 1, `clampView` floors the width
  at 25 m), so the division cannot produce NaN.
- `formatDistance`'s `metres >= 1000` versus `metres > 999` can only differ between 999 and
  1000, and its single caller feeds it `niceDistance`, which returns 1, 2 or 5 times a power
  of ten and never lands there.
- `handleDeleteExisting`'s `if (item.ownerType === "TrailSymbol") return` is unreachable from
  the UI: the JSX renders no delete button in symbol mode at all, and that `{!isSymbol && …}`
  is caught. It is a second line of defence, and testing it would mean calling the handler
  directly rather than through anything a user can do.

**Both last groups needed a second round, and that is the point of doing this.** The
media-upload component caught 23 of 29 first time, and five of the six survivors were tests
that read as if they covered the thing they were named after:

- The race test — *files picked while the read is in flight win over the stored set* —
  counted previews. Both outcomes are **one** preview. Only the file's name, and what
  actually reaches `addTrailImages`, tell them apart.
- *Falls back for a stored target type it does not recognise* asserted the second label read
  "Trail". It reads "Trail" for both trail modes **and** for an unrecognised one, so the
  assertion was blind. The `Attach to` trigger's own text is what distinguishes them.
- *Is cleared when the kind of target changes* asserted the trigger showed the placeholder.
  A Radix Select whose value matches no item renders the placeholder anyway, so a stale
  trail id looked identical to a cleared one. What is in localStorage is what tells them
  apart — and the case that really bites is an **empty facility list**, where the other
  effect (drop a target the list does not contain) bows out and clearing the id at the
  switch is the only thing standing between a trail's id and a facility upload.
- Two tests about persistence never read the store back at all, so neither *never persists*
  nor *wipes the store on the empty first render* showed up as anything.

The first mutation round of the geometry/editor/proposal group caught 63 of 71. Six of the
eight survivors were
real gaps and are worth naming, because each was a test that read as if it covered something
it did not: `fitAll` was never asserted to take the trail in, `clampView` was only ever given
a view of the fitted aspect ratio, `pathFor`'s 15% margin was never the reason a point was
kept, `attachedTo`'s empty-target guard was covered only by a fixture that had nothing with an
empty owner, the source-link `typeof` check was tested with an object (which `new URL` rejects
anyway) rather than a one-element array (which stringifies straight through), and `lengthGap`'s
half-kilometre floor was only ever exercised on a 42 km trail, where the tenth-of-the-length
clause fires first.

## Where the import-review tests draw the line

The backend already owns *does apply write the right rows* — 18 test files under
`Core/TrailImport/` plus four integration suites. So the web tests deliberately cover only
the **guard rails between a reviewer and an irreversible write**, and duplicate none of the
import semantics:

- `src/lib/trail-import-review.ts` holds the selection rules, extracted out of the 600-line
  page so they can be tested without a browser: which selections may be batch-decided
  (`Certain`/`High` only — one `Medium` refuses the batch), whether 'select all' is offered
  yet, and `collectAllMatching`, whose `maxPages` ceiling is the only thing stopping a
  server that always says `hasMore` from spinning in the browser. An incomplete walk returns
  **no selection at all**, because a subset presented as the whole filter is the actual harm.
- `apply-panel.test.tsx` pins the write gate: no apply button before the diff is read,
  disabled when the server says `canApply` is false, one request however fast it is clicked
  twice, no `onApplied` when the write failed, and nothing at all on a session already
  applied. A warning (`againstStrongMatch`, `withoutSegment`) must **not** block — only
  `canApply` decides.
- `trail-import-review-page.test.tsx` proves the wiring rather than the rules: that the
  batch button is really driven by the rule, and that it sends the selected ids.

Rendering that page in a test needs the whole module boundary stubbed — `@/api/trail-import`
(including `confidenceOrder`, a **value** the summary row maps over, so a partial mock
renders nothing), `@/api/trail`, `sonner`, and `ProposalDetail`/`ApplyPanel`, both of which
would otherwise fetch on their own. And because `restoreMocks: true` wipes every
implementation between tests, a `vi.fn().mockResolvedValue(...)` written into a `vi.mock`
factory is gone by the second test: set those in `beforeEach` instead.

## What `setup.ts` adds, and why Radix fails silently without it

jsdom implements none of `hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`,
`scrollIntoView`, `ResizeObserver` or `URL.createObjectURL`. Unlike the Blob swap above these
are **additions**, not replacements, so `setup.ts` installs them globally with `??=`.

The one worth knowing about is pointer capture. Radix's Select and Popover are not native
controls — a `<button role="combobox">` plus a listbox in a portal — and they open from
`pointerdown`, where Radix calls `target.hasPointerCapture(...)`. Without the stub that
throws **inside React's event dispatch, where the error is swallowed**: the click does
nothing, the trigger stays at `aria-expanded="false"`, and the test fails with

```
Unable to find an accessible element with the role "option" and name "…"
```

which points at the assertion rather than the cause. The `TypeError` is on stderr, above the
failure. Measured: five lines of stubs and a Radix Select opens and picks normally.

A no-op `ResizeObserver` means anything measuring itself through one sees 0 × 0.
`geometry-preview.tsx` does exactly that — it is not rendered in any test today (mocked in
`proposal-detail.test.tsx`, and its arithmetic is tested through `src/lib/geometry-preview.ts`
instead), but a future component test of it would need a real size.

Writing those tests also turned up that the media upload's four `Select`s had **no accessible
name** — `<Label>` beside `<SelectTrigger>` with no `htmlFor`/`id` between them, so a screen
reader announced an unnamed combobox. They are wired up now; that is a fix, not a test
affordance.

## Extracting the arithmetic out of a component

Four modules under `src/lib/` exist only so the rules inside a large component can be tested
without rendering it. The split is the same each time: the component keeps the React — state,
effects, refs, JSX — and the lib takes what is a function of its arguments alone.

| lib | taken out of | what it decides |
| --- | --- | --- |
| `trail-import-review.ts` | `trail-import-review-page.tsx` | which proposals may be batch-decided, and whether 'select all' really means all |
| `geometry-preview.ts` | `geometry-preview.tsx` | lon/lat projected to metres, and the fit, zoom, clamp and thinning of the drawn view |
| `media-upload.ts` | `media-upload.tsx` | what the server is told to do to the image bytes, which dropped files are kept, which library images belong to the target |
| `staged-media.ts` | `media-upload.tsx` | what survives a refresh |

`media-upload.tsx` keeps a component test of its own on top of that, because what is left
after the extraction is an **ordering** problem rather than an arithmetic one: a target
restored from localStorage before the lists have loaded, a staged-file read racing the first
render, and a persist effect that must not write until that read has finished. Steering it
needs `loadStagedFiles` held open — the module is mocked with `importOriginal` so everything
else in it stays real, and `beforeEach` points the one mocked function back at
`vi.importActual`'s copy.

`geometry-preview.ts` is the one that pays best. The drawing is the *evidence* the reviewer
decides on, so a fold in the projection is a fold in the evidence — and every one of these is
invisible to `tsc` and to the eye: dropping `Math.cos(latitude)` from the longitude scale draws
a trail at 57°N nearly twice as wide as it is; taking `clampView`'s aspect ratio from the fit
instead of the view squashes the picture the moment the two differ; letting `pathFor` keep the
pen down across a stretch that left the view draws a straight line the trail does not have.

What stays in the component is deliberately not tested twice: `proposal-detail.test.tsx` and
`trail-editor.test.tsx` render the real thing and stub only the module boundary (`@/api/*`,
`sonner`, and `GeometryPreview`, whose SVG is in the way of the decision controls and has its
own tests).

## One bug this round, in `trail-editor.tsx`

The form starts as `emptyForm()` and is filled from `getTrailByIdentifier` when the sheet
opens. If that fetch failed, the catch toasted and `finally` set `loading` false — leaving a
live **Save changes** button over a blank form, on a panel whose own description says the
changes are permanent and cannot be undone. One click sent `name: ""`, `trailLength: 0`,
`description: ""`, `tags: ""`, `city: ""` over the trail. A `loaded` flag now gates both the
button and the form, and the panel says why instead of showing empty inputs.
