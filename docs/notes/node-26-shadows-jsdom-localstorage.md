# On Node 26 the whole `web/` test suite fails, and the error names `clear`

Every test in `web/` — all 383, including pure arithmetic ones like `strideFor` that never
touch a browser API — fails with

```
Cannot read properties of undefined (reading 'clear')
```

The cause is not in the test, the component, or anything the failure names. **Node 26
defines a global `localStorage` that is `undefined` unless the process was started with
`--localstorage-file`**, and that global shadows the one jsdom installs. `src/test/setup.ts`
ends every test with

```ts
afterEach(() => {
  cleanup();
  localStorage.clear();      // <- undefined.clear() on Node 26
  globalThis.indexedDB = new IDBFactory();
});
```

so the `afterEach` throws for every test in every file, whatever the test did. The real tell
is a line Node prints once and which scrolls away above the wall of failures:

```
ExperimentalWarning: localStorage is not available because --localstorage-file was not provided
```

Confirm it in one command:

```sh
node -e "console.log(typeof localStorage)"
```

On Node 24 there is no such global at all; on Node 26 the global exists and is `undefined`.

## What the repo actually expects

`web/Dockerfile`'s build stage and both the `web` and `app` CI jobs pin **Node 24**. Node 26
is a local-machine choice, not the supported version, so this is an artifact of the box
rather than a repo bug — but it looks exactly like a catastrophic regression, which is the
reason to write it down.

## Do not "fix" it with `--localstorage-file`

Setting `NODE_OPTIONS="--localstorage-file=..."` does get 349 of 351 through, which makes it
tempting. It is wrong: Node's file-backed store is **shared across test files**, while
jsdom's is per-environment. Measured, the shared store leaks state between files and breaks
3 tests in `media-upload.test.tsx` that pass in isolation — persistence tests reading back a
value another file wrote. Cross-file pollution is a worse failure than the honest one,
because it is order-dependent.

Run the web suite on Node 24 instead. If a suite-wide failure ever names a method on
`undefined`, check the Node version before reading any test.

Related: [[web-vitest-environment]].
