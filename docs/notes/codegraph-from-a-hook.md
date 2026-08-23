# Driving `codegraph` from a hook: the bundle's own node, and why the query must be exact

`guard-symbol-search.mjs` denies a search for a symbol the CodeGraph index provably holds **and
declares where the search is looking**. It only works because it *asks* the index instead of
guessing, and everything below was measured rather than assumed. All of it fails **silent** —
verified all four ways CodeGraph can be missing, not just the obvious one.

## `codegraph` on PATH is not spawnable, but the bundle is

Rule 3 of [[agent-harness-hooks]] — never a `.cmd`/`.bat` shim, never a shell — rules out
the obvious call. `~/.local/bin/codegraph` is a symlink to
`~/.codegraph/versions/<v>/bin/codegraph`, a `/bin/sh` script; on Windows the equivalent is a
shim, and `run()` is `shell: false`, so spawning it there fails and the guard goes silent.

The way through is that the bundle ships **its own node** beside the real entrypoint. The
launcher's last line is exactly:

```sh
exec "$DIR/node" --liftoff-only --disable-warning=ExperimentalWarning \
     "$DIR/lib/dist/bin/codegraph.js" "$@"
```

so reproducing that gives a real executable on every platform. `resolveLauncher()` tries, **in
this order**: `$CODEGRAPH_BIN`; the bundle found by `realpathSync`-ing the PATH entry and
walking up two levels; the newest `~/.codegraph/versions/*`; and last the PATH launcher itself
(fine on POSIX, where the kernel handles the shebang). It validates the winner with
`--version` before caching it. `--print` reports which one resolved, because "no launcher"
and "no index" both look identical from inside a session: every search simply passes.

On **Windows** the last candidate is the shim case, and spawning it with `shell: false` simply
fails — so the route that has to work there is the `~/.codegraph/versions/*` fallback, with
`node.exe` beside `lib\dist\bin\codegraph.js`. That layout is the one thing here that **cannot
be verified from Linux**. If it differs, `resolveLauncher()` returns null and the guard is
silent on Windows — it fails open, every search runs, and nothing says so. `--print` is the
instrument: run it once on a Windows box and read the `launcher` line.

Reading `.codegraph/codegraph.db` with `node:sqlite` was rejected deliberately. The schema is
codegraph's private business, and Node 22 needs `--experimental-sqlite` while the hook is
spawned as a bare `node script.mjs` — so a version bump would fail open with nothing said.
`codegraph query --json` is a documented interface and costs ~145 ms.

## `codegraph query` is fuzzy, so "returned rows" is not "holds this symbol"

Measured on this tree: `codegraph query GeoPoint` returns **10 rows** — `GeoPointFactory`,
`GeoPointFactory.cs`, `FromLonLat` ×3, `ToLatitude`, `Wgs84Srid` — and **nothing named
`GeoPoint`**. `TrailObstacleService` (the missing-plural typo) returns three
`TrailObstacles*` nodes. A guard keying on "the query found something" would deny both, and
send the session to `codegraph_explore` for a symbol that does not exist.

So the rule is an **exact, case-insensitive name match**, and `kind === "file"` has to agree
with what was asked: a `Grep` must not be answered with a file that happens to be called
that, and a `Glob`/`find -name` must not be answered with a code node.

Among exact matches, the **widest line span wins**. Measured: querying `TrailRepository`
ranks the *constructor* (lines 27–31) above the class (20–402) on score, so taking the first
row names the constructor in the denial. Widest span picks the enclosing declaration and is
language-agnostic in a way a kind-preference list is not.

## An exact match is not a unique match, and saying otherwise states a falsehood

The first version took the widest exact match and presented it as *the* answer. Measured on
this tree, that is wrong more often than it is right:

| the search | exact matches | in | what it used to say |
| --- | --- | --- | --- |
| `Glob **/Utilities.cs` | 2 | 2 files | *"That path **IS** the answer"* — naming `IntegrationTests/Utilities.cs` and dropping `UnitTests/Utilities.cs`, which exists |
| `Grep Program` | 2 | 2 files | named `StigviddAPI::Program`, dropped `MapData::Program` |
| `Grep Create` | 40 at `--limit 40`, 45 at 80 | 39 files | named one arbitrary `UserResponseFactory::Create` |

The `Utilities.cs` row is the one that matters: a guard whose whole justification is *"it asks
the index instead of guessing"* was guessing, and asserting the guess. So `exactHits()` returns
**all** exact matches and the denial lists them — five, then `+N more`.

Two things follow that are easy to get wrong:

- **The query limit is part of the message.** At `--limit 15`, `Create`'s 39 files look like
  12, so any count printed would be fiction. The limit is one constant, 40, used by both the
  query and the text, and when the exact-match count reaches it the denial says "at least 40 …
  the query stopped at 40". Cost of 15 → 40: **143 ms → 153 ms.**
- **One reduction is still right.** A hit *nested inside another hit in the same file* is
  dropped, because a C# class and its constructor are one declaration — and `codegraph query`
  ranks the constructor first. Widest-span-first ordering makes that a single pass. Genuine
  siblings do not nest: `Result` and `Result<T>` (lines 3–33 and 35–44) both survive, and a
  fixture asserts it.

## "The index holds this symbol" is not "the index can answer this search"

The exact-match rule above answers the first question. It took a second gate to notice that
the guard was still denying searches the index could not possibly answer, because it never
asked **where** the search was looking. Measured with `codegraph files -p .`:

| language | files |
| --- | --- |
| csharp | 382 |
| typescript | 206 |
| tsx | 187 |
| javascript | 13 |
| yaml | 2 |
| **markdown** | **0** |

790 files, and not one of them is markdown — in a repo whose own conventions say *"search
`docs/notes/` before re-deriving anything"*. Every one of these was a live deny:

```text
grep -rn GeoPointFactory docs/            grep -rn GeoPointFactory docs/notes/
grep -rn GeoPointFactory CLAUDE.md        grep -rn --include=*.md GeoPointFactory .
Grep {pattern, path: "docs"}              Grep {pattern, glob: "*.md"} / {type: "md"}
```

The tempting fix is a list of prose extensions. The right one is free and needs no list:
**at least one exact hit has to lie inside the path the search named**, and the rows are
already in hand from gate 3. `inScope()` filters them, reusing `relKey`/`under`/`fold` from
`lib.mjs` — which already fold Windows separators *before* resolving and case-fold on win32,
and codegraph emits `filePath` in exactly the repo-relative POSIX shape `relKey` produces.

It generalises past markdown for nothing:

| search | | |
| --- | --- | --- |
| `grep -rn GeoPointFactory docs/` | silent | declared in `backend/`, not here |
| `grep -rn GeoPointFactory backend/Core/Factories/` | silent | callers only — a *usage* search |
| `grep -rn GeoPointFactory backend/` | DENIED | unchanged |
| `grep -rn GeoPointFactory .` | DENIED | `.` restricts nothing |
| `rg -n GeoPointFactory` | DENIED | no scope at all |

Two rules keep it from quietly switching the guard off. A path that will not reduce to a
repo-relative key — `.`, the root, anything outside the repo, a `null` root because `repoRoot()`
failed — **restricts nothing** rather than silencing everything; that is the same fail-open
direction every other gate takes, and a fixture asserts it. And when several operands are
given, one match is enough: `grep -rn Foo docs/ backend/` is still denied.

It also relieved part of [[agent-harness-hooks]] §5b by luck rather than design: a backtick-
quoted `` `grep -rn FromLonLat backend/` `` inside a heredoc leaves ``backend/` `` as the path
operand, which no declaration is under. A heredoc line that begins with a clean `grep` still
fires, and the deny-once hatch is still what makes that survivable.

## A count is the one thing the index cannot answer, and the tools say so out loud

The index holds declarations, not occurrences, so no amount of precision at gate 3 makes
`grep -rc TrailRepository backend/` answerable. This was written off as an irreducible
false positive relieved only by deny-once — wrongly, because all three forms are visible at
gate 1 for free, before any query spawns:

| | |
| --- | --- |
| `-c`, bundled `-rc`, `--count`, rg's `--count-matches` | `-C` is *context*, so the test is case-sensitive — and `C` was already in `SHORT_WITH_VALUE` |
| the Grep tool's `output_mode: "count"` | the tool states the intent; no heuristic needed |
| a `wc` anywhere in the pipeline | over-reaches on purpose: a `wc` on an unrelated file silences the guard, and that costs only a grep that was going to run |

What stays guarded is `-l` / `--files-with-matches`, deliberately: "which files mention this"
*is* something the index answers — `codegraph node <path>` prints `used by 23 files`.

## A negative fixture of `[]` cannot test the exact-name rule

This one bit during construction. The suite had `connectionstrings__stigvidd: []`,
`todo: []`, `srid: []` — real output, and the right test for "identifier-shaped but not a
symbol". But deleting the exact-name check from `exactHit()` left the whole suite **green**:
with no rows, there is nothing to falsely match.

Testing that rule needs a fixture with **rows but no exact match**, which is what the
`geopoint` and `trailobstacleservice` fixtures are for. General form: a filter is only
covered by an input that would survive without it.

**Thirteen mutations are known to go red**, and re-running them is the check worth doing after
any change to the guard — each was verified to take at least one case with it, against the
207-case suite:

| mutation | cases it kills |
| --- | --- |
| gate 4 (`inScope()`) | 14 |
| `commandsIn()` (prefix runs) | 11 |
| listing more than one hit | 8 |
| `deps.indexPresent` (gate 2) | 7 |
| `deps.remember` (the escape hatch) | 7 |
| the `-c` / `--count` gate | 5 |
| the nested-span reduction | 4 |
| the `wc`-in-pipeline gate | 3 |
| exact-name check in `exactHits()` | 2 |
| kind check (file vs symbol) | 2 |
| `output_mode: "count"` | 2 |
| remembering **every** identifier, not just the reported one | 1 |
| `argvOf`'s double-quote escaping rule | 1 |

The kind check dropped from 3 kills to 2 when gate 4 landed, because
`grep -rn Dockerfile docker-compose.yml` is now caught by scope as well as by kind. That is
defence in depth rather than a loss, but it is the kind of drift that makes a stale mutation
table worse than none — the counts above are re-measured, not carried over.

## A `deny` cannot be retried, so this one denies once

There is a real false-positive class no amount of precision removes: every *usage* of a
symbol, a count of occurrences, and per [[agent-harness-hooks]] §5b a Bash command that
merely *documents* a grep inside a heredoc. A plain deny would make those permanently
unreachable and push the session into rewording searches to evade the guard.

So a marker under `stateDir()`, keyed on `(session_id, identifier)`, lets an identical search
through on the second attempt, and the denial text says so. Cost of a false positive is one
round-trip; cost of the guard being a dead end would be the guard being switched off.

**"The second attempt" has to mean the second, and for a while it did not.** The deny path
remembered only the identifier it *reported*, so a line naming two took three tool calls:

```text
grep -rn TrailRepository backend/ && grep -rn GeoPointFactory backend/
  attempt 1  DENY        attempt 2  DENY (on GeoPointFactory)        attempt 3  pass
```

Three places promise otherwise — the denial text, `CLAUDE.md`, and the session-start
orientation — so the deny now records **every** identifier on the line. The general lesson is
that an escape hatch stated in prose is a claim about behaviour, and wants a test like any
other; this one was invisible because every single-identifier case passed.

## The cost, in two tiers

Measured over 10 calls each, this tree, warm, at `--limit 40`:

| | |
| --- | --- |
| any regex, phrase, path or non-search command | **40 ms** — node startup; the shape gate alone |
| a count (`-rc`, `--count`, `\| wc -l`, `output_mode=count`) | **40 ms** — rejected at gate 1 |
| no `.codegraph/` here | **40 ms** — gate 2 short-circuits before any spawn |
| a single-identifier candidate, index consulted | **190 ms** — one `codegraph query` on top |
| the same, cold (launcher unresolved, `--print`) | **246 ms** |

Gate 4 does **not** save the query: it reads the rows, so a prose-scoped search pays the
candidate tier and then passes. That is the price of keying on the index instead of on a list of
extensions, and it is the right trade — a wrong extension list denies real work forever, whereas
this costs 150 ms on a search that then runs.

The `add-a-hook` budget for `PreToolUse` is < 50 ms, and the candidate tier breaks it
knowingly: it is paid only on a search that is *about to be redirected*, and the alternative
it replaces is a dozen grep/read round-trips. If the candidate rate ever makes that a tax,
the downgrade is `speak()` (advisory, exit 2, the search still runs), not a wider shape gate.

**The internal budget has to fit the registered timeout, and "per call" is not "per
identifier".** `.claude/settings.json` gives this hook `"timeout": 15`, and `resolveLauncher()`
probes up to four candidates before `queryIndex()` runs. At the original 4000 ms per probe that
was 4 × 4000 + 5000 = **21 s**, over the limit; a probe that answers measures **52 ms**, so the
probe timeout became 2000 and the arithmetic read 4 × 2000 + 5000 = 13 s.

That arithmetic was still wrong, and it took a measurement to see why: it counts **one** probe
round and **one** query, but `queryIndex()` is called once per identifier on the line, and the
on-disk cache records only *success* — so a box where resolution fails re-probed every
candidate every time. Measured, eight identifiers with every candidate hanging:

| | |
| --- | --- |
| before | **32 085 ms**, against a registered 15 000 |
| after | **4 052 ms** |

Two fixes, and both are needed. `resolveLauncher()` now memoises its result **including the
null** — an in-process memo, not the disk cache, because the null must not be persisted. And
`decide()` stops consulting the index once `GATE3_BUDGET_MS` (10 s) is spent, which bounds the
invocation however many identifiers a line names: the first query may cost 13 s cold, and no
second one starts after it.

The general shape of the bug is worth keeping: a hook's cost is per **event**, and an event can
carry an unbounded number of work items. Any budget written as "one spawn at N ms" is only true
if something enforces the *one*. And it fails open, so nothing complains.

## The markers need pruning, because the TTL is only read

`seenReal()` compares a marker's mtime against a 24 h TTL but nothing deleted, so
`stateDir()/symsearch/` grew one file per `(session_id, identifier)` for the life of the box —
31 of them accumulated in a single afternoon of testing. `pruneMarkers()` now runs on the deny
path only (rare, and already paying for a query), mirroring `plan-eval.mjs`'s `prune()`.
Verified the way it has to be, since nothing else observes it: `touch -d '2 days ago'` one
marker, spawn one deny, confirm the stale file is gone and a fresh one is not.

## Verified silent without CodeGraph — all four ways it can be missing

"Fails silent" is a claim about four different failures, and only the first is the one anybody
thinks of. Each was measured by spawning the hook with an event on stdin:

| | |
| --- | --- |
| no `.codegraph/` (a fresh worktree) | passes, 39 ms |
| `.codegraph/` present, codegraph not installed anywhere | passes, 43 ms |
| a launcher that exists but cannot be spawned (the Windows `.cmd` shim) | passes, 48 ms |
| a launcher that answers `--version` but whose `query` returns non-JSON | passes, 48 ms |

The third and fourth are the ones a unit test will not reach, because the suite injects
`query: () => null` rather than a broken binary. Reproduce them with `CODEGRAPH_BIN` pointed at
a two-line shell script, and remember to delete
`$TMPDIR/stigvidd-hooks-$UID/symsearch-launcher.json` first — a warm cache hides all of it.

## The Windows shapes, and the one that turned out to be a parser bug

`lib.mjs` folds separators before resolving so Windows shapes can be tested from Linux, and
these all behave: a `Glob` pattern of `backend\Core\Common\GeoPointFactory.cs`; `grep.exe`,
`rg.exe`, `find.exe` heads; a quoted `"C:/Program Files/Git/usr/bin/grep.exe"`; the PowerShell
`$env:CI="1";` prefix run; `wc.exe` in a pipeline; bundled `-rc`. `stateDir()` degrades to
`stigvidd-hooks-win` where `process.getuid` does not exist.

Two results worth keeping, because both look like bugs and only one is:

- An **unquoted** `C:/Program Files/.../grep.exe -rn Foo backend/` is not recognised — and
  should not be. Bash would try to run `C:/Program` too. Matching the shell is the correct
  behaviour, not a fail-open.
- A **quoted** `"backend\Core"` *was* mis-parsed. `argvOf` treated backslash as an escape
  anywhere inside double quotes, but bash only lets it escape one of ``$ ` " \`` or a newline —
  so the operand became `backendCore`, gate 4 found no declaration under it, and the guard went
  silent on the exact form a Windows user would type. Fixed in `argvOf`, and the mutation is in
  the table. Note that *unquoted* `backend\Core` correctly stays silent: bash mangles that one
  too, so the command could not have worked either way.

Related: [[agent-harness-hooks]], [[git-worktree-repo-root]] — a fresh worktree has no
`.codegraph/`, which is exactly when this guard must stay silent.
