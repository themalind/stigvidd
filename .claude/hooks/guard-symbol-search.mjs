#!/usr/bin/env node
// PreToolUse(Grep|Glob|Bash): a search for a symbol CodeGraph has already indexed.
//
// CLAUDE.md and the user-level `codegraph prompt-hook` both *tell* a session to reach for
// CodeGraph before grep. Neither enforces it, so a session still opens with
// `grep -rn TrailRepository backend/` and pays a dozen round-trips for what one
// codegraph_explore call answers with source, call paths and blast radius.
//
// The reverse mistake would be worse. `.codegraph/` is per-checkout and uncommitted, so a
// fresh worktree has NO index (docs/notes/git-worktree-repo-root.md), and CodeGraph indexes
// SYMBOLS — it has nothing to say about ConnectionStrings__StigVidd, a migration's SQL body,
// or a string in .env. A guard that blocked those would be switched off within the hour.
//
// So four gates, cheapest first, and anything that does not clear all four is SILENCE:
//
//   1. shape        is the search one bare identifier, and is it asking for a DECLARATION?
//                   (pure string work) A count is not: the index holds declarations, not
//                   occurrences, so `grep -rc`, `--count`, a `wc` in the pipeline and the
//                   Grep tool's own output_mode="count" never reach gate 2.
//   2. availability is there a .codegraph/ here, and a launcher we can spawn without a
//                   shell? Missing either is the FALLBACK-TO-GREP path.
//   3. the index    `codegraph query <ident> --json`, and a deny only on an EXACT name
//                   match. The hook never guesses that CodeGraph knows better — it asks.
//   4. scope        is a declaration actually INSIDE the path the search named? (free — it
//                   reads the rows gate 3 already fetched) `grep -rn GeoPointFactory docs/`
//                   is not a declaration lookup: measured, this index holds 790 files and
//                   NOT ONE of them is markdown. Neither is a search pinned to a directory
//                   holding only the symbol's callers.
//
// Gate 3 is why no heuristic has to recognise a config string: the index simply returns []
// for one. It is also why the match must be exact — `codegraph query` is fuzzy, and asking
// it for GeoPointFactory also returns FromLonLat and ToLatitude on score, so "the query
// returned rows" is a different question from "the index holds this symbol".
//
// Gate 4 is the same principle one step on: "the index holds this symbol" is a different
// question from "the index can answer THIS search". Both gates ask instead of guessing, and
// gate 4 is why no list of prose extensions has to be maintained anywhere.
//
// AND AN EXACT MATCH IS NOT A UNIQUE ONE. This tree holds two files named Utilities.cs, two
// classes named Program, and 40+ methods named Create. Naming the best of them as though it
// were the answer made the denial state something false, so the denial LISTS every exact
// match (LIST_CAP, then "+N more") and lets the reader pick. Same principle as gate 3: ask,
// do not guess.
//
// DENY ONCE, THEN ALLOW. A deny cannot be retried, and one false-positive class survives all
// of the above — every *usage* of a symbol, and per docs/notes/agent-harness-hooks.md §5b a
// Bash command that merely *documents* a grep in a heredoc. An identical search is let
// through on the second attempt, and the denial says so — so no search this guard touches is
// ever unreachable.
//
// COST, in two tiers, because gate 3 does not fit the < 50 ms PreToolUse budget:
//   non-candidate (a regex, a phrase, a path search, a count)   40 ms — node startup, gate 1
//   candidate (the index is consulted)                         190 ms — one query on top
// Measured on this tree over 10 calls each; `--print` reports the query leg. Gate 4 does not
// save the query — it reads the rows — so a prose-scoped search pays the candidate tier and
// then passes. If the candidate rate ever makes that unacceptable, downgrade to speak() rather
// than keep something that taxes every search.
//
// And the budget is per EVENT, not per identifier: one Bash line can name any number of them.
// resolveLauncher() therefore memoises even a null, and gate 3 stops at GATE3_BUDGET_MS —
// without both, eight identifiers on a box where the launcher hangs measured 32 s against the
// registered `"timeout": 15`, which fails OPEN and says nothing.
//
// Everything measured while building this — why the launcher has to be the bundle's own
// node, why the name match has to be exact, why an exact match is not a unique one, why
// widest-span wins over score, and the ten mutations this file's self-test is known to
// catch — is in docs/notes/codegraph-from-a-hook.md. Read it before loosening any of them.
//
// Self-test: `node .claude/hooks/guard-symbol-search.mjs --self-test`
//            `node .claude/hooks/guard-symbol-search.mjs --print`   (what it resolved here)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { readEvent, repoRoot, relKey, under, fold, commandsIn, run, deny, stateDir, mtime, checker, WIN } from "./lib.mjs";

// ---------------------------------------------------------------------------
// gate 1 — is this search one bare identifier?
// ---------------------------------------------------------------------------

// Wrappers a session types AROUND a single identifier. Stripped repeatedly, so `^\bFoo\b$`
// reduces the same as `\bFoo\b`. Everything not listed here is a real regex and is left
// alone — which makes it fail gate 1, which is silence.
const WRAPPERS = [
  /^\(\?:\^\|\\s\)/, // (?:^|\s)Foo
  /^\\b/, //            \bFoo
  /^\^/, //             ^Foo
  /\\b$/, //            Foo\b
  /\$$/, //             Foo$
  /\\s\*\\\($/, //      Foo\s*\(
  /\\\($/, //           Foo\(
  /\\s\*=$/, //         Foo\s*=
];

// A whitelist, deliberately: an unfamiliar character means "not an identifier", so anything
// this does not recognise falls through to silence rather than to a guess.
const QUALIFIED = /^[A-Za-z0-9_]+(?:(?:\.|::)[A-Za-z0-9_]+)*$/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The identifier a search pattern is really about, or null.
 *
 * A qualified pattern reduces to its LAST segment, which is also what keeps a filename
 * typed as a grep pattern out of the way: `TrailRepository.cs` becomes `cs`, which is under
 * the length floor. Three characters, because `id` and `db` match half the tree.
 */
export function identOf(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return null;
  for (let again = true; again; ) {
    again = false;
    for (const re of WRAPPERS) {
      const next = s.replace(re, "");
      if (next !== s) {
        s = next;
        again = true;
      }
    }
  }
  if (!QUALIFIED.test(s)) return null;
  const last = s.split(/::|\./).pop() ?? "";
  if (!IDENT.test(last) || last.length < 3) return null;
  return last;
}

/**
 * The basename a filename-shaped search is really about, or null.
 *
 * `**\/TrailRepository.cs` -> `TrailRepository.cs`; `**\/*.cs` and `*.Designer.cs` -> null,
 * because a wildcard inside the name means the question was not "where is this file".
 */
export function fileNameOf(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const base = s.replace(/\\/g, "/").split("/").pop() ?? "";
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*\.[A-Za-z0-9]+$/.test(base)) return null;
  const stem = base.slice(0, base.lastIndexOf("."));
  if (!identOf(stem)) return null;
  return base;
}

// ---------------------------------------------------------------------------
// pulling the search out of a Bash command
// ---------------------------------------------------------------------------

const GREPS = new Set(["grep", "egrep", "fgrep", "rg", "ripgrep", "ag", "ack", "ack-grep"]);
// grep with no path operand is reading stdin — a pipe or a redirect — and CodeGraph cannot
// answer a question about another command's output. rg/ag/ack default to recursing the cwd,
// and `git grep` to the repo, so for those a path operand is optional.
const NEEDS_PATH = new Set(["grep", "egrep", "fgrep"]);
const LONG_WITH_VALUE = new Set([
  "--include", "--exclude", "--exclude-dir", "--exclude-from", "--file", "--glob", "--iglob",
  "--type", "--type-not", "--type-add", "--after-context", "--before-context", "--context",
  "--max-count", "--max-depth", "--replace", "--color", "--colour", "--binary-files",
  "--devices", "--directories", "--label", "--ignore-file", "--pre", "--sort", "--sortr",
]);
// Short flags whose value is the next token when it is not glued on. `-A 3`, `-m 1`, `-e X`.
const SHORT_WITH_VALUE = "eftTgmABCdD";
// A COUNT is the one search CodeGraph provably cannot answer: the index holds declarations,
// not occurrences. The whole grep family spells it the same way, and `-C` (context) is
// upper-case, so a case-sensitive test tells them apart. Detected here, at gate 1, so a count
// never even spawns a query.
const COUNT_LONG = new Set(["--count", "--count-matches"]);
// File-type filters. `--include=*.md`, rg's `-g '*.md'` and `--type md`. These are gate 4's
// second half: a search restricted to a type the index does not hold is asking about text.
const EXT_LONG = new Set(["--include", "--glob", "--iglob", "--type"]);

/**
 * Every extension a filter names. `*.md` -> [md], `*.{ts,tsx}` -> [ts, tsx], `md` -> [md].
 *
 * Empty for anything else, and empty means "no restriction" — the same fail-open direction
 * every other gate takes.
 */
export function extsOf(value) {
  const s = String(value ?? "").trim();
  if (!s) return [];
  const brace = s.match(/\.?\{([A-Za-z0-9,]+)\}$/);
  if (brace) return brace[1].split(",").filter(Boolean).map((e) => e.toLowerCase());
  const dotted = s.match(/\.([A-Za-z0-9]+)$/);
  if (dotted) return [dotted[1].toLowerCase()];
  return /^[A-Za-z0-9]+$/.test(s) ? [s.toLowerCase()] : []; //  rg --type cs
}

/**
 * The literal directory prefix of a glob, or null when it starts with a wildcard.
 *
 * `docs/**\/Foo.cs` -> `docs`; `**\/Foo.cs` -> null (the whole tree); a pattern with no
 * wildcard at all is a path, so its LAST segment is the filename and the rest is the prefix.
 */
export function globPrefix(pattern) {
  const parts = String(pattern ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  const lead = [];
  for (const p of parts) {
    if (/[*?[\]{}]/.test(p)) break;
    lead.push(p);
  }
  if (lead.length === parts.length) lead.pop(); //  all literal: drop the basename
  return lead.length ? lead.join("/") : null;
}

/** Split one command segment into argv, quotes honoured, stopping at a redirection. */
export function argvOf(seg) {
  const s = String(seg ?? "");
  const out = [];
  let cur = "";
  let quoted = false;
  let q = null;
  const push = () => {
    if (cur || quoted) out.push(cur);
    cur = "";
    quoted = false;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
      // Inside double quotes bash only lets a backslash escape one of $ ` " \ or a newline;
      // anywhere else it stays literal. Getting that wrong turned a quoted Windows path —
      // "backend\Core", the form that actually runs — into `backendCore`, and gate 4 then
      // found no declaration under it and went silent. Single quotes escape nothing.
      else if (c === "\\" && q === '"' && "$`\"\\\n".includes(s[i + 1] ?? "")) cur += s[++i] ?? "";
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      q = c;
      quoted = true;
      continue;
    }
    if (c === "\\") {
      cur += s[++i] ?? "";
      quoted = true;
      continue;
    }
    if (/\s/.test(c)) {
      push();
      continue;
    }
    if (c === ">" || c === "<") break;
    cur += c;
  }
  push();
  return out;
}

/**
 * A grep-family argv reduced to (pattern, the path operands that followed it, filters).
 *
 * Misreading a path as the pattern is harmless — `backend/` fails gate 1 — so this errs
 * toward collecting candidates rather than toward parsing every flag exactly right.
 *
 * `counting` is the exception to that leniency: it has to be right, because it is what keeps
 * `grep -rc Foo` out of the guard's way entirely. `paths` and `exts` are the other: they are
 * what gate 4 reads, and over-collecting there only ever makes the guard quieter.
 */
export function patternOf(args) {
  const bare = [];
  const exts = [];
  let explicit = null;
  let counting = false;
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (t === "--") {
      for (let j = i + 1; j < args.length; j++) bare.push(args[j]);
      break;
    }
    if (t.startsWith("--")) {
      const eq = t.indexOf("=");
      const name = eq === -1 ? t : t.slice(0, eq);
      if (COUNT_LONG.has(name)) counting = true;
      if (name === "--regexp" || name === "--regex") {
        if (explicit === null) explicit = eq === -1 ? (args[i + 1] ?? null) : t.slice(eq + 1);
        if (eq === -1) i++;
        continue;
      }
      if (EXT_LONG.has(name)) exts.push(...extsOf(eq === -1 ? args[i + 1] : t.slice(eq + 1)));
      if (eq === -1 && LONG_WITH_VALUE.has(name)) i++;
      continue;
    }
    if (t.length > 1 && t[0] === "-") {
      const flags = t.slice(1);
      if (flags.includes("c")) counting = true; //  -c, and bundled: -rc, -rnc
      const e = flags.indexOf("e");
      if (e !== -1) {
        const glued = flags.slice(e + 1);
        if (explicit === null) explicit = glued || (args[i + 1] ?? null);
        if (!glued) i++;
        continue;
      }
      const last = flags[flags.length - 1];
      if (last === "g" || last === "t") exts.push(...extsOf(args[i + 1])); //  rg -g '*.md', -t md
      if (SHORT_WITH_VALUE.includes(last)) i++;
      continue;
    }
    bare.push(t);
  }
  if (explicit !== null) return { pattern: explicit, paths: bare, exts, counting };
  return { pattern: bare[0] ?? null, paths: bare.slice(1), exts, counting };
}

/**
 * Every (identifier, wantFile) a Bash command asks for. Empty for anything else.
 *
 * commandsIn() is what makes `CI=1 grep -rn Foo`, `$env:CI="1"; rg Foo` and
 * `set CI=1 && grep -rn Foo` all resolve to the command at their head — a naive matcher
 * sees no recognisable command there and fails OPEN.
 */
export function searchesIn(command) {
  const segs = commandsIn(command);
  // A pipeline that ends in `wc` is asking for a NUMBER, whichever way the grep is spelled:
  // `grep -rn Foo backend/ | wc -l`. Reading the whole command to decide that can over-reach
  // — a `wc` on an unrelated file in the same line silences the guard — and over-reaching
  // here costs nothing but a grep that was going to run anyway.
  for (const seg of segs) {
    const head = (seg.split(/\s+/, 1)[0] ?? "").replace(/\\/g, "/").split("/").pop() ?? "";
    if (head.replace(/\.(?:exe|cmd|bat)$/i, "").toLowerCase() === "wc") return [];
  }
  const found = [];
  // commandsIn() deliberately reports MORE execution positions than a shell would, and a
  // prefix run is one of them: `$env:CI="1"; rg -n Foo` yields both the whole string (prefix
  // stripped) and the position after the `;`, i.e. the same search twice. Dedupe on what we
  // actually act on.
  const add = (s) => {
    if (!found.some((f) => f.ident === s.ident && f.wantFile === s.wantFile)) found.push(s);
  };
  for (const seg of segs) {
    const args = argvOf(seg);
    if (!args.length) continue;
    const head = (args[0].replace(/\\/g, "/").split("/").pop() ?? "").replace(/\.(?:exe|cmd|bat)$/i, "");
    let rest = args.slice(1);
    let name = head.toLowerCase();

    if (name === "git") {
      // `git --no-pager grep Foo` — global flags may sit before the subcommand.
      let i = 0;
      while (i < rest.length && rest[i].startsWith("-")) i++;
      if ((rest[i] ?? "").toLowerCase() !== "grep") continue;
      rest = rest.slice(i + 1);
      name = "git-grep";
    }

    if (name === "find") {
      // `find docs -name X`: the roots are the operands before the first predicate.
      const roots = [];
      for (const t of rest) {
        if (t.startsWith("-")) break;
        roots.push(t);
      }
      for (let i = 0; i < rest.length - 1; i++)
        if (rest[i] === "-name" || rest[i] === "-iname") {
          const base = fileNameOf(rest[i + 1]);
          if (base)
            add({
              ident: base,
              wantFile: true,
              what: `find … -name "${rest[i + 1]}"`,
              scope: { paths: roots, exts: [] },
            });
        }
      continue;
    }

    if (name !== "git-grep" && !GREPS.has(name)) continue;
    const { pattern, paths, exts, counting } = patternOf(rest);
    if (pattern === null) continue;
    if (counting) continue; //          a count is not a symbol lookup
    if (NEEDS_PATH.has(name) && paths.length === 0) continue; // reading stdin
    const ident = identOf(pattern);
    if (ident) add({ ident, wantFile: false, what: `${head} … ${pattern}`, scope: { paths, exts } });
  }
  return found;
}

// ---------------------------------------------------------------------------
// gate 2 — a launcher we can spawn without a shell
// ---------------------------------------------------------------------------

// Rule 3 of docs/notes/agent-harness-hooks.md: never a .cmd/.bat shim, never a shell. And
// `codegraph` on PATH is a launcher script — an sh script on POSIX, a shim on Windows. But
// the bundle it points into ships its OWN node next to the real entrypoint:
//
//   exec "$DIR/node" --liftoff-only --disable-warning=ExperimentalWarning \
//        "$DIR/lib/dist/bin/codegraph.js" "$@"
//
// so reproducing that line gives a real executable on every platform. Candidates in order,
// first one that answers wins, and none resolvable is silence.
const ENTRY = path.join("lib", "dist", "bin", "codegraph.js");
const NODE_PRE = ["--liftoff-only", "--disable-warning=ExperimentalWarning"];

function bundleLauncher(dir) {
  if (!dir) return null;
  const entry = path.join(dir, ENTRY);
  if (!existsSync(entry)) return null;
  for (const n of WIN ? ["node.exe", "node"] : ["node"]) {
    const bin = path.join(dir, n);
    if (existsSync(bin)) return { cmd: bin, pre: [...NODE_PRE, entry] };
  }
  return null;
}

function onPath(name) {
  const exts = WIN ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of String(process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, name + ext);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

/** Newest-first, tolerating whatever shape the version dirs are named in. */
function versionDirs() {
  const root = path.join(homedir(), ".codegraph", "versions");
  let names = [];
  try {
    names = readdirSync(root);
  } catch {
    return [];
  }
  const key = (n) => (n.match(/\d+/g) ?? []).map(Number);
  return names
    .sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      for (let i = 0; i < Math.max(ka.length, kb.length); i++)
        if ((kb[i] ?? -1) !== (ka[i] ?? -1)) return (kb[i] ?? -1) - (ka[i] ?? -1);
      return b.localeCompare(a);
    })
    .map((n) => path.join(root, n));
}

const CACHE = path.join(stateDir(), "symsearch-launcher.json");

// In-process memo, and it HAS TO HOLD THE NULL. The on-disk CACHE records only success, so
// before this a box where resolution fails re-probed every candidate on every call — and
// queryIndex() is called once per identifier, so the probe cost multiplied by N. Measured:
// eight identifiers on one line with every candidate hanging took 32 s against a registered
// `"timeout": 15`, i.e. a stall that fails open with nothing said. See the note.
let MEMO = null; // {value} once resolved, so a null result is remembered as a result

export function resolveLauncher({ noCache = false } = {}) {
  if (!noCache && MEMO) return MEMO.value;
  const memoize = (v) => {
    if (!noCache) MEMO = { value: v };
    return v;
  };
  if (!noCache) {
    try {
      const raw = JSON.parse(readFileSafe(CACHE) ?? "null");
      if (raw?.cmd && existsSync(raw.cmd) && (raw.pre ?? []).every((a) => !a.endsWith(".js") || existsSync(a)))
        return memoize({ cmd: raw.cmd, pre: raw.pre ?? [], from: "cache" });
    } catch {
      /* a stale or corrupt cache just means resolving again */
    }
  }

  const tries = [];
  const env = process.env.CODEGRAPH_BIN;
  if (env && existsSync(env)) tries.push({ cmd: env, pre: [], from: "CODEGRAPH_BIN" });

  const viaPath = onPath("codegraph");
  if (viaPath) {
    let real = viaPath;
    try {
      real = realpathSync(viaPath);
    } catch {
      /* not a link, or unreadable — the raw path is still worth a try */
    }
    const b = bundleLauncher(path.dirname(path.dirname(real)));
    if (b) tries.push({ ...b, from: "bundle (via PATH)" });
  }
  for (const dir of versionDirs()) {
    const b = bundleLauncher(dir);
    if (b) {
      tries.push({ ...b, from: "bundle (~/.codegraph/versions)" });
      break;
    }
  }
  // Last: the launcher itself. Fine on POSIX, where the kernel handles `#!/bin/sh`; on
  // Windows this is the shim case and spawning it without a shell simply fails, which is
  // the fallback-to-grep path.
  if (viaPath) tries.push({ cmd: viaPath, pre: [], from: "PATH" });

  // 2000, not more, and the arithmetic is the point: `tries` holds up to four candidates, so
  // the cold path is 4 x 2000 + the 5000 of one query = 13 s, inside the "timeout": 15 this
  // hook is registered with. A probe that answers measures 52 ms here, so this is still 38x
  // headroom — and a candidate that needs longer than 2 s is not one worth waiting for.
  for (const t of tries) {
    const r = run(t.cmd, [...t.pre, "--version"], { timeout: 2000 });
    if (r && r.code === 0) {
      try {
        mkdirSync(stateDir(), { recursive: true });
        writeFileSync(CACHE, JSON.stringify({ cmd: t.cmd, pre: t.pre }));
      } catch {
        /* a cache we cannot write costs one probe per call, not correctness */
      }
      return memoize(t);
    }
  }
  return memoize(null);
}

function readFileSafe(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// gate 3 — ask the index
// ---------------------------------------------------------------------------

// One constant, because the message reports what the query asked for: at 15 the 39 files
// holding a `Create` look like 12, and a count the guard prints has to be the real one.
// Measured cost of 15 -> 40 on this tree: 143 ms -> 153 ms.
export const QUERY_LIMIT = 40;

// How long gate 3 may spend consulting the index, across ALL of a line's identifiers.
//
// This is the second half of the timeout fix, and the arithmetic is the point. The memo makes
// resolveLauncher() probe at most once per invocation (≤ 4 × 2000 ms), and queryIndex() allows
// 5000 ms, so the FIRST query can cost 13 s cold. At 10 000 ms no second query is ever started
// after it, which bounds the whole invocation at ~13 s inside the registered `"timeout": 15`.
// Without this, N identifiers meant N × 5 s of queries on top — measured at 32 s for N=8.
export const GATE3_BUDGET_MS = 10_000;

/** Parsed `codegraph query` rows, or null when the index could not be consulted. */
export function queryIndex(root, ident) {
  const l = resolveLauncher();
  if (!l) return null;
  const r = run(l.cmd, [...l.pre, "query", ident, "-p", root, "--json", "--limit", String(QUERY_LIMIT)], {
    timeout: 5000,
    env: { NO_COLOR: "1" },
  });
  if (!r || r.code !== 0) return null;
  try {
    const rows = JSON.parse(r.stdout);
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

const span = (n) => Number(n.endLine ?? 0) - Number(n.startLine ?? 0);

/**
 * EVERY exact-name node this search was asking for, widest span first.
 *
 * An exact match is not a unique match, and taking one of several was this guard's worst bug:
 * `Glob **\/Utilities.cs` announced "that path IS the answer" while dropping the second
 * `Utilities.cs`, which exists. Measured on this tree: `Utilities.cs` and `Program` each
 * resolve to 2 files, `Create` to 45 declarations across 39. So the denial lists what the
 * index holds and lets the reader pick — the hook still never guesses.
 *
 * One reduction, and only one: a hit NESTED inside another hit in the SAME file is dropped.
 * A C# class and its constructor both answer to `TrailRepository` and `codegraph query` ranks
 * the constructor first, but they are one declaration, not two. Widest-span-first ordering is
 * what makes that a single pass, and it is language-agnostic in a way a kind-preference list
 * is not. Genuine siblings — `Result` and `Result<T>` — do not nest, so both survive.
 */
export function exactHits(rows, ident, wantFile) {
  if (!Array.isArray(rows)) return [];
  const want = ident.toLowerCase();
  const hits = [];
  for (const row of rows) {
    const n = row?.node ?? row;
    if (!n || typeof n !== "object") continue;
    if (String(n.name ?? "").toLowerCase() !== want) continue;
    if ((String(n.kind ?? "") === "file") !== wantFile) continue;
    hits.push(n);
  }
  hits.sort(
    (a, b) =>
      span(b) - span(a) ||
      String(a.filePath ?? "").localeCompare(String(b.filePath ?? "")) ||
      Number(a.startLine ?? 0) - Number(b.startLine ?? 0),
  );
  const out = [];
  for (const n of hits) {
    const enclosed = out.some(
      (o) =>
        String(o.filePath ?? "") === String(n.filePath ?? "") &&
        Number(o.startLine ?? 0) <= Number(n.startLine ?? 0) &&
        Number(o.endLine ?? 0) >= Number(n.endLine ?? 0),
    );
    if (!enclosed) out.push(n);
  }
  return out;
}

/** The widest exact match alone — what `--print` and the live checks want. */
export const exactHit = (rows, ident, wantFile) => exactHits(rows, ident, wantFile)[0] ?? null;

// ---------------------------------------------------------------------------
// gate 4 — is the declaration actually where the search is looking?
// ---------------------------------------------------------------------------

/**
 * The exact hits that lie inside the scope the search named. All of them when it named none.
 *
 * MEASURED, and this is the whole reason the gate exists: `codegraph files` reports 790 files
 * here — 382 csharp, 206 typescript, 187 tsx, 13 javascript, 2 yaml — and NOT ONE markdown
 * file. So `grep -rn GeoPointFactory docs/` and `--include=*.md` are asking about text the
 * index does not hold, exactly as a count asks for a number it does not hold. Denying those
 * blocked this repo's own documented workflow ("search docs/notes/ before re-deriving").
 *
 * Keying on the ROWS rather than on a list of prose extensions is what makes it free and
 * general: the query already ran, and every hit carries a filePath. If no declaration of the
 * symbol lives where the search is pointed, the search is about usages or about text — and
 * `grep -rn GeoPointFactory backend/Core/Factories/` (callers only) is silenced for the same
 * reason and just as correctly.
 *
 * relKey/under/fold do the path work, deliberately: they already fold Windows separators
 * BEFORE resolving and case-fold on win32, and codegraph emits filePath in the same
 * repo-relative POSIX shape relKey produces.
 */
export function inScope(nodes, scope, root) {
  if (!scope) return nodes;
  const exts = (scope.exts ?? []).map((e) => String(e).toLowerCase());
  // A path we cannot reduce to a repo-relative key — `.`, the root itself, something outside
  // the repo — restricts nothing, so the whole path condition drops rather than guessing.
  const raw = scope.paths ?? [];
  const keys = [];
  let unbounded = raw.length === 0;
  for (const p of raw) {
    const k = root ? relKey(root, p) : null;
    if (k === null) unbounded = true;
    else keys.push(k);
  }
  return nodes.filter((n) => {
    const file = String(n.filePath ?? "");
    if (!file) return unbounded && !exts.length; // no path to judge: only an unscoped search
    if (!unbounded && !keys.some((k) => under(fold(file), k))) return false;
    // Extensions are case-insensitive on every platform, so this one does not go through
    // fold() — that is a win32-only fold and `.MD` has to match `.md` on Linux too.
    if (exts.length && !exts.some((e) => file.toLowerCase().endsWith(`.${e}`))) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// the escape hatch
// ---------------------------------------------------------------------------

const MARKERS = path.join(stateDir(), "symsearch");
const MARKER_TTL_MS = 24 * 60 * 60 * 1000;

function markerFor(session, ident) {
  const h = createHash("sha1").update(`${session}\n${ident.toLowerCase()}`).digest("hex").slice(0, 16);
  return path.join(MARKERS, `${h}.seen`);
}

function seenReal(session, ident) {
  const m = mtime(markerFor(session, ident));
  return m !== null && Date.now() - m < MARKER_TTL_MS;
}

function rememberReal(session, ident) {
  try {
    mkdirSync(MARKERS, { recursive: true });
    writeFileSync(markerFor(session, ident), ident);
  } catch {
    /* if we cannot record it, the next identical search is denied again — annoying, safe */
  }
  pruneMarkers();
}

/**
 * Drop markers past the TTL, as plan-eval.mjs does for its own state.
 *
 * seenReal() only READS the TTL, so without this the directory grows one file per
 * (session, identifier) for the life of the box. Called from the deny path alone, which is
 * rare and already paying for a query — the 42 ms tier never reaches it.
 */
function pruneMarkers() {
  try {
    const cutoff = Date.now() - MARKER_TTL_MS;
    for (const name of readdirSync(MARKERS)) {
      const p = path.join(MARKERS, name);
      const m = mtime(p);
      if (m !== null && m < cutoff) rmSync(p, { force: true });
    }
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// the decision
// ---------------------------------------------------------------------------

/**
 * null for silence, or {ident, wantFile, nodes, what} for a deny.
 *
 * `deps` is injected so the self-test can drive gates 1, 3 and 4 with verbatim fixtures and no
 * codegraph at all: {indexPresent, root, query(ident), seen(ident), remember(ident), expired?}.
 */
export function decide(ev, deps) {
  const tool = String(ev?.tool_name ?? "");
  const input = ev?.tool_input ?? {};
  const wanted = [];

  if (tool === "Grep") {
    // The Grep tool says outright that it wants a number, so this needs no heuristic at all.
    if (String(input.output_mode ?? "") === "count") return null;
    const ident = identOf(input.pattern);
    // The tool states its own scope in three named fields, so gate 4 needs no parsing here.
    if (ident)
      wanted.push({
        ident,
        wantFile: false,
        what: `Grep for \`${input.pattern}\``,
        scope: {
          paths: input.path ? [String(input.path)] : [],
          exts: [...extsOf(input.glob), ...extsOf(input.type)],
        },
      });
  } else if (tool === "Glob") {
    const base = fileNameOf(input.pattern);
    if (base) {
      const prefix = globPrefix(input.pattern);
      wanted.push({
        ident: base,
        wantFile: true,
        what: `Glob for \`${input.pattern}\``,
        scope: { paths: prefix ? [prefix] : [], exts: [] },
      });
    }
  } else if (tool === "Bash") {
    for (const s of searchesIn(input.command)) wanted.push({ ...s, what: `\`${s.what}\`` });
  }
  if (!wanted.length) return null; // gate 1
  if (!deps.indexPresent) return null; // gate 2 — the fallback-to-grep path

  for (const w of wanted) {
    if (deps.seen(w.ident)) continue; // already nudged once; this is the retry
    // Every query costs a spawn, and a line can name any number of identifiers. Out of budget
    // is silence, not a late deny: see resolveLauncher()'s memo and the registered timeout.
    if (deps.expired?.()) break;
    const rows = deps.query(w.ident);
    const nodes = inScope(exactHits(rows, w.ident, w.wantFile), w.scope, deps.root); // gates 3, 4
    if (!nodes.length) continue;
    // Remember EVERY identifier on the line, not just the one reported. A deny cannot be
    // retried, and `grep -rn A backend/ && grep -rn B backend/` used to need THREE attempts:
    // the retry skipped A and denied on B. The denial text, CLAUDE.md and the session-start
    // orientation all promise the SECOND attempt goes through, so it has to.
    for (const other of wanted) deps.remember(other.ident);
    // The set is truncated when the query came back full of exact matches, and then the count
    // the message prints is a floor, not a total. `Create` does this: 40 of 40.
    const exact = Array.isArray(rows)
      ? rows.filter((r) => String((r?.node ?? r)?.name ?? "").toLowerCase() === w.ident.toLowerCase()).length
      : 0;
    return { ...w, nodes, truncated: exact >= QUERY_LIMIT };
  }
  return null;
}

// At most this many are listed; past it the reader wants the tool, not a wall of paths.
const LIST_CAP = 5;

/** The "+N more" line under the list, or "" when everything is on show. */
function more(d) {
  const extra = d.nodes.length - LIST_CAP;
  if (extra <= 0 && !d.truncated) return "";
  const parts = [];
  if (extra > 0) parts.push(`+${extra} more`);
  if (d.truncated) parts.push(`the query stopped at ${QUERY_LIMIT}, so there may be others`);
  return `\n  … ${parts.join(" — ")}`;
}

function countPhrase(d, noun) {
  const n = d.nodes.length;
  const atLeast = d.truncated ? "at least " : "";
  return `${atLeast}${n} ${noun}${n === 1 && !d.truncated ? "" : "s"}`;
}

function message(d) {
  const shown = d.nodes.slice(0, LIST_CAP);
  const one = d.nodes.length === 1 && !d.truncated;
  // The name as the INDEX spells it, not as the search typed it. `grep -rni geopointfactory`
  // matched case-insensitively at gate 3, and echoing that back suggested
  // codegraph_explore("geopointfactory") under a listing that says `GeoPointFactory`.
  const name = String(shown[0]?.name ?? d.ident);
  const retry =
    "If that does not answer what you actually need — every *usage* of it, or text that is " +
    "not a symbol — re-run this exact search. The second attempt is allowed through.";

  if (d.wantFile) {
    // `explore` takes symbol names, so suggest the stem rather than the basename.
    const stem = name.replace(/\.[^.]+$/, "");
    const list = shown
      .map((n) => `  ${n.filePath}${n.endLine ? `  (${n.endLine} lines)` : ""}`)
      .join("\n");
    const head = one
      ? `${d.what} is looking for a file CodeGraph has already located:`
      : `${d.what} is looking for a filename CodeGraph holds ${countPhrase(d, "path")} for:`;
    const answer = one
      ? "That path IS the answer, so no filesystem walk is needed."
      : "Those paths ARE the answer, so no filesystem walk is needed.";
    return (
      `${head}\n${list}${more(d)}\n\n` +
      `${answer} For the contents of one, with line numbers, plus what depends on it:\n` +
      `  codegraph_explore("${stem}")     the MCP tool, preferred\n` +
      `  codegraph node ${shown[0].filePath}\n\n` +
      `If you were after something else — every file matching a pattern, or a path this ` +
      `index does not cover — re-run this exact search. The second attempt is allowed ` +
      `through.`
    );
  }

  const list = shown
    .map((n) => {
      const where = n.filePath ? `${n.filePath}${n.startLine ? `:${n.startLine}` : ""}` : "(indexed)";
      return `  ${n.kind ?? "symbol"} ${n.qualifiedName || n.name} — ${where}`;
    })
    .join("\n");
  const head = one
    ? `${d.what} searches text for something CodeGraph has indexed as a symbol:`
    : `${d.what} searches text for a name CodeGraph has indexed ${countPhrase(d, "time")}:`;
  const call = one
    ? "One call returns its verbatim source, the call paths into and out of it (including the " +
      "dynamic-dispatch hops grep cannot follow) and what depends on it:"
    : "One call returns their verbatim source, the call paths into and out of them (including " +
      "the dynamic-dispatch hops grep cannot follow) and what depends on them:";
  return (
    `${head}\n${list}${more(d)}\n\n${call}\n` +
    `  codegraph_explore("${name}")     the MCP tool, preferred\n` +
    `  codegraph explore "${name}"      the shell form, always works\n\n${retry}`
  );
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  if (process.argv.includes("--print")) return report();

  const ev = readEvent();
  const root = repoRoot(ev);
  if (!root) return 0;
  const session = String(ev.session_id ?? "nosession");
  const t0 = Date.now();
  const d = decide(ev, {
    indexPresent: existsSync(path.join(root, ".codegraph")),
    root,
    query: (ident) => queryIndex(root, ident),
    seen: (ident) => seenReal(session, ident),
    remember: (ident) => rememberReal(session, ident),
    expired: () => Date.now() - t0 > GATE3_BUDGET_MS,
  });
  return d ? deny(message(d)) : 0;
}

// ---------------------------------------------------------------------------
// --print: what this box actually resolved, since every failure here is silent
// ---------------------------------------------------------------------------

function report() {
  const root = repoRoot({});
  const l = resolveLauncher({ noCache: true });
  process.stdout.write(`repo root      ${root ?? "(not found)"}\n`);
  process.stdout.write(
    `.codegraph/    ${root && existsSync(path.join(root, ".codegraph")) ? "present" : "ABSENT — every search passes through"}\n`,
  );
  process.stdout.write(`launcher       ${l ? `${l.cmd} ${l.pre.join(" ")}  [${l.from}]` : "NONE — every search passes through"}\n`);
  if (root && l) {
    const t0 = Date.now();
    const rows = queryIndex(root, "GeoPointFactory");
    const ms = Date.now() - t0;
    const hit = exactHit(rows, "GeoPointFactory", false);
    process.stdout.write(`query          ${rows ? `${rows.length} row(s) in ${ms} ms` : "FAILED"}, exact hit: ${hit ? `${hit.kind} at ${hit.filePath}:${hit.startLine}` : "none"}\n`);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// self-test
// ---------------------------------------------------------------------------

// Verbatim `codegraph query <name> -p . --json --limit 15` output from this tree, trimmed
// to the fields the hook reads. Keeping it real is what stops the parser from being tested
// against a shape codegraph does not emit.
const FIXTURES = {
  trailrepository: [
    { node: { id: "method:247cfb5f", kind: "method", name: "TrailRepository", qualifiedName: "Core.Repositories::TrailRepository::TrailRepository", filePath: "backend/Core/Repositories/TrailRepository.cs", language: "csharp", startLine: 27, endLine: 31 }, score: 114.2 },
    { node: { id: "class:8faf25d1", kind: "class", name: "TrailRepository", qualifiedName: "Core.Repositories::TrailRepository", filePath: "backend/Core/Repositories/TrailRepository.cs", language: "csharp", startLine: 20, endLine: 402 }, score: 113.1 },
  ],
  geopointfactory: [
    { node: { id: "class:f81e0446", kind: "class", name: "GeoPointFactory", qualifiedName: "Core.Common::GeoPointFactory", filePath: "backend/Core/Common/GeoPointFactory.cs", language: "csharp", startLine: 10, endLine: 53 }, score: 113.4 },
    { node: { id: "file:backend/Core/Common/GeoPointFactory.cs", kind: "file", name: "GeoPointFactory.cs", qualifiedName: "backend/Core/Common/GeoPointFactory.cs", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 1, endLine: 54 }, score: 100.0 },
    // The fuzzy tail: same file, different names. An exact-match rule is what ignores these.
    { node: { id: "method:aa11", kind: "method", name: "FromLonLat", qualifiedName: "Core.Common::GeoPointFactory::FromLonLat", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 33, endLine: 36 }, score: 40.2 },
  ],
  fromlonlat: [
    { node: { id: "method:aa11", kind: "method", name: "FromLonLat", qualifiedName: "Core.Common::GeoPointFactory::FromLonLat", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 33, endLine: 36 }, score: 112.0 },
  ],
  "trailrepository.cs": [
    { node: { id: "file:backend/Core/Repositories/TrailRepository.cs", kind: "file", name: "TrailRepository.cs", qualifiedName: "backend/Core/Repositories/TrailRepository.cs", filePath: "backend/Core/Repositories/TrailRepository.cs", startLine: 1, endLine: 402 }, score: 100.0 },
  ],
  "geopointfactory.cs": [
    { node: { id: "file:backend/Core/Common/GeoPointFactory.cs", kind: "file", name: "GeoPointFactory.cs", qualifiedName: "backend/Core/Common/GeoPointFactory.cs", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 1, endLine: 54 }, score: 100.0 },
  ],
  // Rows, but NO exact match — the case that makes the exact-name rule load-bearing rather
  // than decorative. Verbatim: `GeoPoint` is a plausible thing to grep for and the index
  // holds nothing by that name, only GeoPointFactory and its members; `TrailObstacleService`
  // is the missing-plural typo. Drop the name check and BOTH of these start denying, which
  // is exactly the fail-open this pair exists to catch.
  geopoint: [
    { node: { id: "class:f81e0446", kind: "class", name: "GeoPointFactory", qualifiedName: "Core.Common::GeoPointFactory", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 10, endLine: 53 }, score: 59.5 },
    { node: { id: "file:backend/Core/Common/GeoPointFactory.cs", kind: "file", name: "GeoPointFactory.cs", qualifiedName: "backend/Core/Common/GeoPointFactory.cs", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 1, endLine: 54 }, score: 50.5 },
    { node: { id: "method:297b2b58", kind: "method", name: "FromLonLat", qualifiedName: "Core.Common::GeoPointFactory::FromLonLat", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 33, endLine: 34 }, score: 36.1 },
    { node: { id: "constant:ac8fa655", kind: "constant", name: "Wgs84Srid", qualifiedName: "Core.Common::GeoPointFactory::Wgs84Srid", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 12, endLine: 12 }, score: 28.8 },
  ],
  trailobstacleservice: [
    { node: { id: "method:0ee00a12", kind: "method", name: "TrailObstaclesService", qualifiedName: "Core.Services::TrailObstaclesService::TrailObstaclesService", filePath: "backend/Core/Services/TrailObstaclesService.cs", startLine: 18, endLine: 28 }, score: 40.5 },
    { node: { id: "interface:db583f4e", kind: "interface", name: "ITrailObstaclesService", qualifiedName: "Core.Interfaces.Services::ITrailObstaclesService", filePath: "backend/Core/Interfaces/Services/ITrailObstaclesService.cs", startLine: 5, endLine: 13 }, score: 39.3 },
    { node: { id: "class:fa140f31", kind: "class", name: "TrailObstaclesService", qualifiedName: "Core.Services::TrailObstaclesService", filePath: "backend/Core/Services/TrailObstaclesService.cs", startLine: 11, endLine: 187 }, score: 38.5 },
  ],
  // A find whose basename is not the name of any file node: the exact-name rule rejects it
  // on the name alone, before kind ever comes up.
  "wgs84srid.cs": [
    { node: { id: "constant:ac8fa655", kind: "constant", name: "Wgs84Srid", qualifiedName: "Core.Common::GeoPointFactory::Wgs84Srid", filePath: "backend/Core/Common/GeoPointFactory.cs", startLine: 12, endLine: 12 }, score: 28.8 },
  ],
  // SYNTHETIC, and the only two rows here that are. Kind discrimination needs a case where
  // the NAME matches exactly and the kind is wrong, and this tree cannot supply one: a file
  // node's name carries its extension, so it can only collide with a grep identifier when
  // the file has none — Dockerfile, Jenkinsfile, Makefile — and codegraph indexes neither
  // here (measured: both queries return []). The rule still has to hold, because a tree
  // where they ARE indexed would otherwise have `grep -rn Dockerfile` answered with "it is
  // a file at ./Dockerfile" when what was asked for was every mention of the word.
  dockerfile: [
    { node: { id: "file:Dockerfile", kind: "file", name: "Dockerfile", qualifiedName: "Dockerfile", filePath: "Dockerfile", startLine: 1, endLine: 40 }, score: 100.0 },
  ],
  "loosepart.cs": [
    { node: { id: "class:synthetic1", kind: "class", name: "LoosePart.cs", qualifiedName: "Nowhere::LoosePart.cs", filePath: "backend/Core/Nowhere.cs", startLine: 3, endLine: 90 }, score: 90.0 },
  ],
  // Two exact matches in two different files, and the reason the message lists instead of
  // picking. Taking the widest here named StigviddAPI::Program and silently dropped
  // MapData::Program, which exists.
  program: [
    { node: { id: "class:92521596", kind: "class", name: "Program", qualifiedName: "Program", filePath: "backend/MapData/Program.cs", startLine: 6, endLine: 151 }, score: 113.0 },
    { node: { id: "class:c38cf800", kind: "class", name: "Program", qualifiedName: "StigviddAPI::Program", filePath: "backend/StigviddAPI/Program.cs", startLine: 20, endLine: 248 }, score: 112.4 },
  ],
  // The same defect on the Glob path, where the old text asserted "That path IS the answer"
  // about one of the two `Utilities.cs` this repo really has.
  "utilities.cs": [
    { node: { id: "file:backend/Tests/IntegrationTests/Utilities.cs", kind: "file", name: "Utilities.cs", qualifiedName: "backend/Tests/IntegrationTests/Utilities.cs", filePath: "backend/Tests/IntegrationTests/Utilities.cs", startLine: 1, endLine: 839 }, score: 100.0 },
    { node: { id: "file:backend/Tests/UnitTests/Utilities.cs", kind: "file", name: "Utilities.cs", qualifiedName: "backend/Tests/UnitTests/Utilities.cs", filePath: "backend/Tests/UnitTests/Utilities.cs", startLine: 1, endLine: 818 }, score: 100.0 },
  ],
  // A name the tree holds 40+ times: `codegraph query Create --limit 40` returns 40 rows and
  // all 40 are exact, so the count is a floor and the denial has to say so. Eight of the real
  // rows, which is enough to exceed LIST_CAP and to show +N more.
  create: [
    { node: { id: "method:df912b75", kind: "method", name: "Create", qualifiedName: "Core.Factories::CityAreaResponseFactory::Create", filePath: "backend/Core/Factories/CityAreaResponseFactory.cs", startLine: 18, endLine: 55 }, score: 113.0 },
    { node: { id: "method:0ed716ce", kind: "method", name: "Create", qualifiedName: "Core.Factories::CityAreaResponseFactory::Create", filePath: "backend/Core/Factories/CityAreaResponseFactory.cs", startLine: 57, endLine: 60 }, score: 112.9 },
    { node: { id: "method:4e8c1a69", kind: "method", name: "Create", qualifiedName: "Core.Factories::HikeResponseFactory::Create", filePath: "backend/Core/Factories/HikeResponseFactory.cs", startLine: 8, endLine: 23 }, score: 112.8 },
    { node: { id: "method:120e0a62", kind: "method", name: "Create", qualifiedName: "Core.Factories::ReviewResponseFactory::Create", filePath: "backend/Core/Factories/ReviewResponseFactory.cs", startLine: 16, endLine: 33 }, score: 112.7 },
    { node: { id: "method:1f78af36", kind: "method", name: "Create", qualifiedName: "Core.Factories::ReviewResponseFactory::Create", filePath: "backend/Core/Factories/ReviewResponseFactory.cs", startLine: 35, endLine: 44 }, score: 112.6 },
    { node: { id: "method:548c9042", kind: "method", name: "Create", qualifiedName: "Core.Factories::TrailResponseFactory::Create", filePath: "backend/Core/Factories/TrailResponseFactory.cs", startLine: 16, endLine: 65 }, score: 112.5 },
    { node: { id: "method:fe89c60c", kind: "method", name: "Create", qualifiedName: "Core.Factories::UserResponseFactory::Create", filePath: "backend/Core/Factories/UserResponseFactory.cs", startLine: 18, endLine: 73 }, score: 112.4 },
    { node: { id: "method:b3682695", kind: "method", name: "Create", qualifiedName: "Core.Factories::FacilityResponseFactory::Create", filePath: "backend/Core/Factories/FacilityResponseFactory.cs", startLine: 28, endLine: 41 }, score: 112.3 },
  ],
  // Identifier-shaped and NOT a symbol. `codegraph query` really does return [] for these,
  // which is the whole reason no heuristic has to recognise a config key.
  connectionstrings__stigvidd: [],
  todo: [],
  srid: [],
  healthy: [],
};

function selfTest() {
  const { ok, done } = checker("guard-symbol-search");
  let n = 0;

  // --- gate 1 in isolation --------------------------------------------------------
  const identCases = [
    ["TrailRepository", "TrailRepository"],
    ["\\bFromLonLat\\b", "FromLonLat"],
    ["^GeoPointFactory$", "GeoPointFactory"],
    ["(?:^|\\s)GeoPointFactory\\b", "GeoPointFactory"],
    ["GeoPointFactory\\(", "GeoPointFactory"],
    ["GeoPointFactory\\s*\\(", "GeoPointFactory"],
    ["Core.Common::GeoPointFactory", "GeoPointFactory"],
    ["ConnectionStrings__StigVidd", "ConnectionStrings__StigVidd"], // shape OK; gate 3 kills it
    // Must be null: a real regex, a phrase, a filename, or too short to mean anything.
    ["geometry\\(.*4326\\)", null],
    ["SRID 4326", null],
    ["Trail|Hike", null],
    ["Foo.*", null],
    ["[A-Z]{3}", null],
    ["TrailRepository.cs", null], //  last segment is `cs`
    ["db", null],
    ["4326", null],
    ["", null],
    [undefined, null],
  ];
  for (const [raw, want] of identCases) {
    n++;
    ok(identOf(raw) === want, `identOf(${JSON.stringify(raw)}) => ${identOf(raw)}, want ${want}`);
  }

  const fileCases = [
    ["**/GeoPointFactory.cs", "GeoPointFactory.cs"],
    ["backend/**/TrailRepository.cs", "TrailRepository.cs"],
    ["**/*.cs", null],
    ["*.Designer.cs", null],
    ["**/*ModelSnapshot.cs", null],
    ["**/db.ts", null], //  stem under the length floor
    ["src/**", null],
  ];
  for (const [raw, want] of fileCases) {
    n++;
    ok(fileNameOf(raw) === want, `fileNameOf(${JSON.stringify(raw)}) => ${fileNameOf(raw)}, want ${want}`);
  }

  // --- pulling a search out of a Bash command -------------------------------------
  const bashCases = [
    // [command, expected idents]
    ["grep -rn TrailRepository backend/", ["TrailRepository"]],
    ['grep -rn "GeoPointFactory" backend/Core', ["GeoPointFactory"]],
    ["grep -rn --include=*.cs FromLonLat backend", ["FromLonLat"]],
    ["grep -rn -e TrailRepository backend/", ["TrailRepository"]],
    ["grep -rnA 3 TrailRepository backend/", ["TrailRepository"]],
    ["rg -n GeoPointFactory", ["GeoPointFactory"]], // rg needs no path operand
    ['rg --type cs "FromLonLat"', ["FromLonLat"]],
    ["ag TrailRepository", ["TrailRepository"]],
    ["git grep FromLonLat", ["FromLonLat"]],
    ["git --no-pager grep TrailRepository", ["TrailRepository"]],
    ['find backend -name "TrailRepository.cs"', ["TrailRepository.cs"]],
    // The three shell prefixes. Unhandled, each one fails OPEN — there is no recognisable
    // command at the head of the string.
    ["CI=1 grep -rn TrailRepository backend/", ["TrailRepository"]],
    ['$env:CI="1"; rg -n TrailRepository', ["TrailRepository"]],
    ["set CI=1 && grep -rn TrailRepository backend/", ["TrailRepository"]],
    ["cd backend && grep -rn TrailRepository Core/", ["TrailRepository"]],
    // A COUNT. Every one of these denies if its rule is removed, which is why they are here
    // rather than in the note as a known trade.
    ["grep -rc TrailRepository backend/", []],
    ["grep -c TrailRepository backend/", []],
    ["grep -rnc TrailRepository backend/", []], //  bundled
    ["grep --count TrailRepository backend/", []],
    ["rg --count-matches GeoPointFactory", []],
    ["grep -rn TrailRepository backend/ | wc -l", []], //  the pipeline asks for a number
    ["rg -n GeoPointFactory | wc -l", []],
    // ...but -C is CONTEXT, not count, and a files-with-matches list IS something the index
    // answers (`codegraph node <path>` prints "used by N files"). Both must still be caught.
    ["grep -rnC 3 TrailRepository backend/", ["TrailRepository"]],
    ["grep -rl TrailRepository backend/", ["TrailRepository"]],
    // Must yield nothing.
    ["docker compose ps | grep healthy", []], //  grep on a pipe, no path operand
    ["dotnet build 2>&1 | grep -c error", []],
    ['grep -rn "TODO" app/src', ["TODO"]], //  shape passes, gate 3 returns []
    ['grep -rn "SRID 4326" docs/', []],
    ['grep -rn "geometry(.*4326)" backend/', []],
    ['find . -name "*.Designer.cs"', []],
    ["git log --oneline -5", []],
    ["cd web && npm run generate:api", []],
    ["node scripts/check-hooks.mjs", []],
  ];
  for (const [cmd, want] of bashCases) {
    n++;
    const got = searchesIn(cmd).map((s) => s.ident);
    ok(
      got.length === want.length && got.every((g, i) => g === want[i]),
      `searchesIn(${cmd}) => [${got}], want [${want}]`,
    );
  }

  // --- gate 3, against the verbatim fixtures --------------------------------------
  const q = (ident) => FIXTURES[ident.toLowerCase()] ?? [];
  // `create` is the truncated case in real life (40 exact rows against --limit 40) but the
  // fixture keeps 8, so drive truncation through the same predicate decide() uses rather than
  // pasting 40 near-identical rows in.
  const qFull = (ident) => {
    const rows = q(ident);
    if (ident.toLowerCase() !== "create") return rows;
    const pad = [];
    for (let i = rows.length; i < QUERY_LIMIT; i++)
      pad.push({ node: { id: `method:pad${i}`, kind: "method", name: "Create", qualifiedName: `Padding${i}::Create`, filePath: `backend/Core/Factories/Pad${i}.cs`, startLine: 1, endLine: 9 }, score: 10 });
    return [...rows, ...pad];
  };
  // A fixed root, so gate 4 resolves scope paths identically on all three platforms. The
  // fixture filePaths are repo-relative POSIX, which is the shape codegraph really emits.
  const ROOT = WIN ? "C:\\repo" : "/repo";
  const fresh = () => {
    const seen = new Set();
    return {
      deps: (indexPresent = true) => ({
        indexPresent,
        root: ROOT,
        query: q,
        seen: (i) => seen.has(i.toLowerCase()),
        remember: (i) => seen.add(i.toLowerCase()),
      }),
      has: (i) => seen.has(i.toLowerCase()),
    };
  };

  const denyCases = [
    [{ tool_name: "Grep", tool_input: { pattern: "TrailRepository" } }, "class"],
    [{ tool_name: "Grep", tool_input: { pattern: "\\bFromLonLat\\b" } }, "method"],
    [{ tool_name: "Grep", tool_input: { pattern: "^GeoPointFactory$" } }, "class"],
    [{ tool_name: "Glob", tool_input: { pattern: "**/GeoPointFactory.cs" } }, "file"],
    [{ tool_name: "Bash", tool_input: { command: "grep -rn TrailRepository backend/" } }, "class"],
    [{ tool_name: "Bash", tool_input: { command: 'find backend -name "TrailRepository.cs"' } }, "file"],
    [{ tool_name: "Bash", tool_input: { command: "CI=1 rg -n GeoPointFactory" } }, "class"],
  ];
  for (const [ev, kind] of denyCases) {
    n++;
    const d = decide(ev, fresh().deps());
    ok(d !== null, `expected a deny for ${JSON.stringify(ev.tool_input)}`);
    // The WIDEST exact match wins — the class, not its constructor — and a symbol search
    // must never land on the file node while a file search must land on nothing else.
    if (d) {
      n++;
      ok(
        d.nodes[0].kind === kind,
        `${JSON.stringify(ev.tool_input)} matched a ${d.nodes[0].kind}, want ${kind}`,
      );
      n++;
      ok(d.nodes.length === 1, `${JSON.stringify(ev.tool_input)} should resolve to ONE declaration, got ${d.nodes.length}`);
      n++;
      ok(/codegraph_explore\(/.test(message(d)), "the denial must carry the call that works");
      n++;
      ok(/re-run this exact search/.test(message(d)), "the denial must name the escape hatch");
    }
  }

  // The negatives. Every one of these is ordinary work, and a guard that fires on ordinary
  // work gets switched off within the hour.
  const silentCases = [
    // Rows came back, but nothing is NAMED this. Removing the exact-name rule in exactHit()
    // leaves the rest of this suite green and only these three go red — which is why they
    // are here.
    { tool_name: "Grep", tool_input: { pattern: "GeoPoint" } },
    { tool_name: "Grep", tool_input: { pattern: "TrailObstacleService" } },
    { tool_name: "Bash", tool_input: { command: 'find backend -name "Wgs84Srid.cs"' } },
    // Kind discrimination, both directions. A grep for a word must not be answered with a
    // FILE that happens to be called that, and a file search must not be answered with a
    // code node that happens to be named like a filename.
    { tool_name: "Grep", tool_input: { pattern: "Dockerfile" } },
    { tool_name: "Bash", tool_input: { command: 'grep -rn Dockerfile docker-compose.yml' } },
    { tool_name: "Glob", tool_input: { pattern: "**/LoosePart.cs" } },
    { tool_name: "Grep", tool_input: { pattern: "ConnectionStrings__StigVidd" } }, // [] from the index
    { tool_name: "Grep", tool_input: { pattern: "TODO" } },
    { tool_name: "Grep", tool_input: { pattern: "geometry\\(.*4326\\)" } },
    { tool_name: "Grep", tool_input: { pattern: "SRID 4326" } },
    { tool_name: "Glob", tool_input: { pattern: "**/*.cs" } },
    { tool_name: "Glob", tool_input: { pattern: "**/*ModelSnapshot.cs" } },
    { tool_name: "Bash", tool_input: { command: "docker compose ps | grep healthy" } },
    { tool_name: "Bash", tool_input: { command: 'grep -rn "TODO" app/src' } },
    { tool_name: "Bash", tool_input: { command: 'find . -name "*.Designer.cs"' } },
    { tool_name: "Bash", tool_input: { command: "cd backend && dotnet build" } },
    { tool_name: "Read", tool_input: { file_path: "backend/Core/Repositories/TrailRepository.cs" } },
    { tool_name: "Grep", tool_input: {} },
    {},
  ];
  for (const ev of silentCases) {
    n++;
    ok(decide(ev, fresh().deps()) === null, `expected silence for ${JSON.stringify(ev)}`);
  }

  // Gate 2: no index here means every one of the DENY cases passes through instead. This is
  // the fallback-to-grep requirement, and it is the half most likely to rot unnoticed.
  for (const [ev] of denyCases) {
    n++;
    ok(decide(ev, fresh().deps(false)) === null, `no .codegraph/ must mean silence: ${JSON.stringify(ev.tool_input)}`);
  }
  // ...and so does an index that cannot be consulted at all (launcher missing, query threw).
  for (const [ev] of denyCases) {
    n++;
    const d = decide(ev, { indexPresent: true, query: () => null, seen: () => false, remember: () => {} });
    ok(d === null, `an unreadable index must mean silence: ${JSON.stringify(ev.tool_input)}`);
  }

  // --- the escape hatch -----------------------------------------------------------
  {
    const f = fresh();
    const deps = f.deps();
    const ev = { tool_name: "Grep", tool_input: { pattern: "TrailRepository" } };
    n++;
    ok(decide(ev, deps) !== null, "first search must be denied");
    n++;
    ok(decide(ev, deps) === null, "the identical retry must be allowed through");
    n++;
    ok(f.has("TrailRepository"), "the deny must record the marker, or the retry is denied too");
    n++;
    ok(
      decide({ tool_name: "Grep", tool_input: { pattern: "GeoPointFactory" } }, deps) !== null,
      "a DIFFERENT symbol in the same session must still be denied",
    );
    // §5b: a Bash command that merely quotes a guarded search — a heredoc, a note being
    // written — is matched too, because commandsIn() treats every NEWLINE as a command
    // position, so a heredoc body line beginning with `grep` is read as a grep. The escape
    // hatch is what makes that survivable rather than a dead end.
    const doc = {
      tool_name: "Bash",
      tool_input: { command: "cat <<'EOF' > note.md\ngrep -rn FromLonLat backend/\nEOF" },
    };
    const f2 = fresh();
    const deps2 = f2.deps();
    n++;
    ok(decide(doc, deps2) !== null, "the §5b case is expected to fire — that is the known trade");
    n++;
    ok(decide(doc, deps2) === null, "...and the retry must go through, so it is not a dead end");
    // But only when the mangled operands still land inside the symbol's own tree. Backticks
    // around the quoted command leave `backend/\`` as the path operand, which gate 4 rejects —
    // so gate 4 relieves part of §5b for free. Documented because it is luck, not design.
    n++;
    ok(
      decide(
        { tool_name: "Bash", tool_input: { command: "cat <<'EOF' > note.md\nrun `grep -rn FromLonLat backend/`\nEOF" } },
        fresh().deps(),
      ) === null,
      "a backtick-quoted grep leaves no usable path operand, so gate 4 silences it",
    );
  }

  // --- gate 4: is the declaration where the search is looking? ---------------------
  // MEASURED premise: `codegraph files` reports 790 indexed files here — csharp, typescript,
  // tsx, javascript, yaml — and ZERO markdown. Every row below was a live DENY before gate 4.
  {
    const scopeCases = [
      // [event, expect a deny?, why]
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory docs/" } }, false, "docs/ holds no declaration"],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory CLAUDE.md" } }, false, "a named .md file"],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory docs/notes/" } }, false, "the notes workflow"],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn --include=*.md GeoPointFactory ." } }, false, "an --include filter"],
      [{ tool_name: "Bash", tool_input: { command: "rg -n -g *.md GeoPointFactory" } }, false, "rg -g"],
      [{ tool_name: "Bash", tool_input: { command: "rg -n -t md GeoPointFactory" } }, false, "rg --type"],
      [{ tool_name: "Grep", tool_input: { pattern: "GeoPointFactory", path: "docs" } }, false, "the Grep tool's path"],
      [{ tool_name: "Grep", tool_input: { pattern: "GeoPointFactory", glob: "*.md" } }, false, "the Grep tool's glob"],
      [{ tool_name: "Grep", tool_input: { pattern: "GeoPointFactory", type: "md" } }, false, "the Grep tool's type"],
      // A directory holding only the CALLERS is a usage search, and must be silent too.
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory backend/Core/Factories/" } }, false, "callers only"],
      [{ tool_name: "Bash", tool_input: { command: 'find docs -name "TrailRepository.cs"' } }, false, "find outside the tree"],
      [{ tool_name: "Glob", tool_input: { pattern: "docs/**/GeoPointFactory.cs" } }, false, "a glob rooted in docs/"],
      // ...and everything that WAS a deny still is. This half is what stops gate 4 from
      // quietly turning the whole guard off.
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory backend/" } }, true, "the declaring tree"],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory backend/Core/Common" } }, true, "the declaring dir"],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory backend/Core/Common/GeoPointFactory.cs" } }, true, "the declaring file itself"],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory ." } }, true, "`.` restricts nothing"],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn --include=*.cs GeoPointFactory ." } }, true, "an --include that DOES match"],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory docs/ backend/" } }, true, "one operand of several matches"],
      [{ tool_name: "Bash", tool_input: { command: "rg -n GeoPointFactory" } }, true, "no scope at all"],
      [{ tool_name: "Grep", tool_input: { pattern: "GeoPointFactory" } }, true, "the Grep tool with no path"],
      [{ tool_name: "Glob", tool_input: { pattern: "**/GeoPointFactory.cs" } }, true, "a wildcard-rooted glob"],
      [{ tool_name: "Glob", tool_input: { pattern: "backend/Core/Common/GeoPointFactory.cs" } }, true, "a fully literal glob"],
    ];
    for (const [ev, wantDeny, why] of scopeCases) {
      n++;
      const d = decide(ev, fresh().deps());
      ok(
        wantDeny ? d !== null : d === null,
        `gate 4 (${why}): ${JSON.stringify(ev.tool_input)} should ${wantDeny ? "DENY" : "be silent"}`,
      );
    }
    // Gate 4 must not fire when there is nothing to judge: a root of null (repoRoot failed)
    // leaves every path unresolvable, which restricts nothing rather than silencing everything.
    n++;
    const noRoot = { ...fresh().deps(), root: null };
    ok(
      decide({ tool_name: "Bash", tool_input: { command: "grep -rn GeoPointFactory backend/" } }, noRoot) !== null,
      "an unresolvable root must not silence the guard",
    );
  }

  // --- the pieces gate 4 is built from --------------------------------------------
  for (const [raw, want] of [
    ["*.md", ["md"]],
    ["**/*.md", ["md"]],
    ["md", ["md"]],
    ["*.{ts,tsx}", ["ts", "tsx"]],
    ["cs", ["cs"]],
    ["", []],
    [undefined, []],
    ["docs/**", []],
  ]) {
    n++;
    const got = extsOf(raw);
    ok(
      got.length === want.length && got.every((g, i) => g === want[i]),
      `extsOf(${JSON.stringify(raw)}) => [${got}], want [${want}]`,
    );
  }
  for (const [raw, want] of [
    ["docs/**/Foo.cs", "docs"],
    ["**/Foo.cs", null],
    ["*.cs", null],
    ["backend/Core/Common/GeoPointFactory.cs", "backend/Core/Common"],
    ["backend\\Core\\Common\\GeoPointFactory.cs", "backend/Core/Common"], //  the Windows shape
    ["Foo.cs", null],
    ["backend/**", "backend"],
  ]) {
    n++;
    ok(globPrefix(raw) === want, `globPrefix(${JSON.stringify(raw)}) => ${globPrefix(raw)}, want ${want}`);
  }

  // --- the retry promise holds for ANY number of identifiers on the line -----------
  // Measured before the fix: this took THREE attempts. deps.remember() ran for the reported
  // identifier only, so attempt 2 skipped TrailRepository and denied on GeoPointFactory —
  // while the denial text, CLAUDE.md and session-start.mjs all promise the second goes through.
  {
    const f = fresh();
    const deps = f.deps();
    const two = {
      tool_name: "Bash",
      tool_input: { command: "grep -rn TrailRepository backend/ && grep -rn GeoPointFactory backend/" },
    };
    n++;
    ok(decide(two, deps) !== null, "a two-identifier line must be denied once");
    n++;
    ok(decide(two, deps) === null, "...and the SECOND attempt must go through, not the third");
    for (const i of ["TrailRepository", "GeoPointFactory"]) {
      n++;
      ok(f.has(i), `the deny must remember ${i} — every identifier on the line, not just the reported one`);
    }
    // Three identifiers, same promise.
    const f3 = fresh();
    const d3 = f3.deps();
    const three = {
      tool_name: "Bash",
      tool_input: { command: "rg -n TrailRepository; rg -n GeoPointFactory; rg -n FromLonLat" },
    };
    n++;
    ok(decide(three, d3) !== null, "a three-identifier line must be denied once");
    n++;
    ok(decide(three, d3) === null, "...and go through on the second attempt too");
  }

  // A spent budget is silence, not a late deny: gate 3 costs one spawn per identifier.
  {
    let queried = 0;
    const deps = {
      indexPresent: true,
      root: ROOT,
      query: (i) => {
        queried++;
        return q(i);
      },
      seen: () => false,
      remember: () => {},
      expired: () => true,
    };
    n++;
    ok(decide({ tool_name: "Grep", tool_input: { pattern: "TrailRepository" } }, deps) === null, "an expired budget must mean silence");
    n++;
    ok(queried === 0, "an expired budget must not spawn a query");
  }

  // --- the Windows shapes, exercised from any platform -----------------------------
  // lib.mjs folds separators before resolving precisely so these can be tested off win32.
  {
    const winCases = [
      // A Glob pattern is not shell argv, so its backslashes are separators and fold to `/`.
      [{ tool_name: "Glob", tool_input: { pattern: "backend\\Core\\Common\\GeoPointFactory.cs" } }, true],
      // A Bash operand IS shell argv, and the Bash tool runs Git Bash on Windows, so
      // `backend\Core` unescapes to `backendCore` — for the shell as much as for argvOf. The
      // command cannot work, gate 4 finds no declaration under it, and silence is correct.
      // Quoted or forward-slashed — the forms that actually run — are guarded.
      [{ tool_name: "Bash", tool_input: { command: "grep -rn TrailRepository backend\\Core" } }, false],
      [{ tool_name: "Bash", tool_input: { command: 'grep -rn TrailRepository "backend\\Core"' } }, true],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn TrailRepository backend/Core" } }, true],
      [{ tool_name: "Bash", tool_input: { command: "grep.exe -rn TrailRepository backend/" } }, true],
      [{ tool_name: "Bash", tool_input: { command: "rg.exe -n GeoPointFactory" } }, true],
      [{ tool_name: "Bash", tool_input: { command: 'find.exe backend -name "TrailRepository.cs"' } }, true],
      [{ tool_name: "Bash", tool_input: { command: '"C:/Program Files/Git/usr/bin/grep.exe" -rn FromLonLat backend/' } }, true],
      // Counts and pipelines keep their Windows spelling too.
      [{ tool_name: "Bash", tool_input: { command: "grep -rc TrailRepository backend\\Core" } }, false],
      [{ tool_name: "Bash", tool_input: { command: "grep -rn TrailRepository backend/ | wc.exe -l" } }, false],
      // An UNQUOTED path with a space is not a command in any shell, so not recognising it is
      // correct rather than a fail-open — `C:/Program` is the head a shell would try too.
      [{ tool_name: "Bash", tool_input: { command: "C:/Program Files/Git/usr/bin/grep.exe -rn FromLonLat backend/" } }, false],
    ];
    for (const [ev, wantDeny] of winCases) {
      n++;
      const d = decide(ev, fresh().deps());
      ok(wantDeny ? d !== null : d === null, `windows shape ${JSON.stringify(ev.tool_input)} should ${wantDeny ? "DENY" : "pass"}`);
    }
  }

  // --- an exact match is not a unique match ---------------------------------------
  // Deleting the nesting filter in exactHits() makes this 2 (the class AND its constructor)
  // and leaves every other case green.
  n++;
  ok(
    exactHits(FIXTURES.trailrepository, "TrailRepository", false).length === 1,
    "a constructor nested in its class is one declaration, not two",
  );
  // ...and a genuine sibling pair must NOT be collapsed by that filter.
  {
    const siblings = [
      { node: { kind: "class", name: "Result", qualifiedName: "Core.Common::Result", filePath: "backend/Core/Common/Result.cs", startLine: 3, endLine: 33 } },
      { node: { kind: "method", name: "Result", qualifiedName: "Core.Common::Result::Result", filePath: "backend/Core/Common/Result.cs", startLine: 9, endLine: 13 } },
      { node: { kind: "class", name: "Result", qualifiedName: "Core.Common::Result<T>", filePath: "backend/Core/Common/Result.cs", startLine: 35, endLine: 44 } },
      { node: { kind: "method", name: "Result", qualifiedName: "Core.Common::Result<T>::Result", filePath: "backend/Core/Common/Result.cs", startLine: 39, endLine: 43 } },
    ];
    n++;
    ok(exactHits(siblings, "Result", false).length === 2, "two non-overlapping declarations must both survive");
  }

  // Every hit gets named. Each of these fails against a message built from one node.
  {
    const deps = fresh().deps();
    const d = decide({ tool_name: "Grep", tool_input: { pattern: "Program" } }, deps);
    n++;
    ok(d !== null && d.nodes.length === 2, `Program should resolve to 2 declarations, got ${d?.nodes.length}`);
    const m = d ? message(d) : "";
    for (const p of ["backend/MapData/Program.cs", "backend/StigviddAPI/Program.cs"]) {
      n++;
      ok(m.includes(p), `the denial dropped ${p} — it must name every match`);
    }
    n++;
    ok(!/\bindexed as a symbol\b/.test(m), "the singular claim must not survive a 2-hit denial");
  }
  {
    const deps = fresh().deps();
    const d = decide({ tool_name: "Glob", tool_input: { pattern: "**/Utilities.cs" } }, deps);
    n++;
    ok(d !== null && d.nodes.length === 2, "both Utilities.cs must be named");
    const m = d ? message(d) : "";
    for (const p of ["backend/Tests/IntegrationTests/Utilities.cs", "backend/Tests/UnitTests/Utilities.cs"]) {
      n++;
      ok(m.includes(p), `the denial dropped ${p} — this is the bug that said "that path IS the answer"`);
    }
    n++;
    ok(!/That path IS the answer/.test(m), "a 2-path denial must not claim one path is the answer");
  }
  // Truncation: a name held QUERY_LIMIT times or more is reported as a floor, and only the
  // first LIST_CAP are listed.
  {
    const seen = new Set();
    const deps = { indexPresent: true, query: qFull, seen: (i) => seen.has(i), remember: (i) => seen.add(i) };
    const d = decide({ tool_name: "Grep", tool_input: { pattern: "Create" } }, deps);
    n++;
    ok(d !== null && d.truncated === true, "a saturated query must be reported as truncated");
    const m = d ? message(d) : "";
    n++;
    ok(/at least/.test(m), "a truncated count must be stated as a floor");
    n++;
    ok(/\+\d+ more/.test(m), "past LIST_CAP the denial must say how many it left out");
    n++;
    ok(m.split("\n").filter((l) => /^  (method|class|file) /.test(l)).length === LIST_CAP, `exactly ${LIST_CAP} hits should be listed`);
  }
  // The Grep tool's own count mode: no heuristic, and it must not even reach gate 3.
  {
    let queried = false;
    const deps = { indexPresent: true, query: (i) => { queried = true; return q(i); }, seen: () => false, remember: () => {} };
    n++;
    ok(decide({ tool_name: "Grep", tool_input: { pattern: "TrailRepository", output_mode: "count" } }, deps) === null, "output_mode=count must pass through");
    n++;
    ok(queried === false, "a count must not spawn a query at all");
    n++;
    ok(decide({ tool_name: "Grep", tool_input: { pattern: "TrailRepository", output_mode: "content" } }, deps) !== null, "...but content mode is still guarded");
  }

  // --- launcher resolution, end to end, opt-in ------------------------------------
  if (process.argv.includes("--with-codegraph")) {
    n++;
    const l = resolveLauncher({ noCache: true });
    ok(l !== null, "no codegraph launcher resolved on this box — the guard is silent here");
    if (l) {
      const root = repoRoot({});
      n++;
      const rows = queryIndex(root, "GeoPointFactory");
      ok(Array.isArray(rows) && rows.length > 0, "live `codegraph query` returned nothing");
      n++;
      ok(exactHit(rows, "GeoPointFactory", false)?.kind === "class", "live exact hit is not the class");
      n++;
      ok(exactHit(rows, "GeoPointFactory", false)?.filePath === "backend/Core/Common/GeoPointFactory.cs", "live hit has the wrong path");
      n++;
      ok(exactHit(queryIndex(root, "zzzNotARealSymbolXyz"), "zzzNotARealSymbolXyz", false) === null, "a nonsense identifier must not hit");
      // The memo: a second resolution must be the SAME OBJECT, not a second probe round.
      // Identity is the only observable difference, and it is the one that matters — without
      // it, N identifiers on a line meant N probe rounds (measured: 32 s for N=8).
      n++;
      ok(resolveLauncher() === resolveLauncher(), "resolveLauncher() must be memoised within the process");
      n++;
      ok(resolveLauncher({ noCache: true }) !== null, "--print's noCache path must still resolve");
    }
  }

  return done(n);
}

process.exit(main());
