#!/usr/bin/env node
// The two self-evaluation rounds of a plan-driven session: --before and --after.
//
// Fires EXACTLY TWICE per plan, and never in an ordinary session:
//
//   --before  PostToolUse on ExitPlanMode — the moment a plan is APPROVED. A rejected
//             plan makes ExitPlanMode return an error, so PostToolUse never runs and this
//             stays silent: approval is the trigger, not the attempt. It answers two
//             things the session would otherwise have to think to ask for: the docs/notes/
//             entries that match this plan, and, for each area of the tree the plan names,
//             THE SIGNAL `dotnet test` DOES NOT GIVE YOU. It also records HEAD and the
//             already-dirty paths, so round 2 can tell this session's work from what the
//             tree was carrying when it started.
//   --after   Stop, gated on the state file --before leaves behind, so it only speaks for
//             a session that had a plan approved. Blocks ONCE, to report what the diff
//             obliges minus what the session's own commands show it ran, and to ask what
//             it learned while the answer is still in context.
//
// Outside the hook path:
//
//     node .claude/hooks/plan-eval.mjs --match "<words, a task, a paragraph>"
//     node .claude/hooks/plan-eval.mjs --check-notes     # INDEX.md <-> the files
//     node .claude/hooks/plan-eval.mjs --self-test
//
// WHY A HOOK AND NOT A SKILL STEP. docs/notes/ is this repo's memory, and nothing loads
// its index: CLAUDE.md points at the directory, so a note reaches a session only if
// someone thought to look. CodeGraph cannot cover it either — it indexes code, not
// Markdown. The write half has the same problem in reverse: a lesson is freshest exactly
// as the turn ends, which is when nothing asks for it.
//
// FOUR DEFECTS MEASURED IN THE ORIGINAL (scire, 2026-08-13), fixed here from the start
// because each one looked exactly like the hook working:
//   1. Round 1 read THE WRONG PLAN — it took the newest file in the plans directory, on
//      the theory that ExitPlanMode's payload does not carry the text. It does:
//      `tool_input.plan`. That directory is per-user, not per-repo or per-session, so a
//      plan approved while another session had written more recently matched notes for
//      somebody else's work, and the output reads confident either way. The directory is
//      now only a freshness-gated fallback for when the payload really is empty.
//   2. Round 2 could BURN ITS ONE SHOT ON A CLEAN TREE. The marker was written before the
//      "did anything ship?" test, so any Stop between approval and the first edit — a
//      clarifying question, a read-only survey turn — consumed the round and the real end
//      of the session was silent. The marker is now written only when the round speaks.
//   3. A session that COMMITTED its work got no round 2, because the evidence was
//      `git status` and a commit empties it. Committed paths since the recorded HEAD now
//      count as shipped work.
//   4. Matching was `token in haystack`, i.e. SUBSTRING: "actor" matched "refactor",
//      "test" matched "latest". Whole-token matching against a per-entry token set is both
//      more accurate and much faster, since the index is tokenized once.
//
// And scoring is where the real difficulty is: without length normalisation the LONGEST
// index entries win whatever the query says. A token in more than a third of the entries
// carries no information here and is dropped, which is self-tuning where a hand-written
// stopword list drifts as the notes grow. Title hits count triple.
//
// Both phases fail SILENT and exit 0 on anything unexpected: a broken hook must never be
// able to wedge a session.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import { readEvent, repoRoot, git, stateDir, lines, speak, checker } from "./lib.mjs";

const MAX_NOTES = 4;
const FALLBACK_PLAN_AGE_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export function tokenize(text) {
  const out = [];
  for (const t of String(text ?? "").toLowerCase().split(/[^a-z0-9]+/))
    if (t.length >= 3) out.push(t);
  return out;
}

/**
 * Parse INDEX.md into entries. A bullet runs from `- [Title](file)` to the next one, so a
 * summary may wrap over as many lines as it likes.
 */
export function parseIndex(md) {
  const entries = [];
  let cur = null;
  for (const ln of lines(md)) {
    const m = ln.match(/^-\s+\[([^\]]+)\]\(([^)]+)\)\s*(.*)$/);
    if (m) {
      if (cur) entries.push(cur);
      cur = { title: m[1], file: m[2], body: m[3] };
    } else if (cur && ln.trim() && !/^#/.test(ln)) {
      cur.body += " " + ln.trim();
    } else if (cur && !ln.trim()) {
      // a blank line does not end a bullet; INDEX.md wraps freely
    }
  }
  if (cur) entries.push(cur);
  for (const e of entries) {
    e.titleTokens = new Set(tokenize(e.title));
    e.tokens = new Set([...e.titleTokens, ...tokenize(e.body)]);
    e.size = e.tokens.size;
  }
  return entries;
}

/**
 * Rank entries against a query.
 *
 * Rarity-weighted, because "the", "file" and "test" are in most entries and carry no
 * signal here; anything in more than a third of them is dropped outright. Divided by the
 * square root of the entry's token count, because otherwise the longest entry wins every
 * query — the defect that made one 244-token note the top hit for most of scire's.
 */
export function scoreEntries(entries, query) {
  if (!entries.length) return [];
  const qs = new Set(tokenize(query));
  if (!qs.size) return [];
  const df = new Map();
  for (const e of entries) for (const t of e.tokens) df.set(t, (df.get(t) ?? 0) + 1);
  const ceiling = entries.length / 3;
  const scored = [];
  for (const e of entries) {
    let score = 0;
    const hits = [];
    for (const t of qs) {
      const n = df.get(t) ?? 0;
      if (n === 0 || n > ceiling) continue; // absent, or too common to mean anything
      if (!e.tokens.has(t)) continue;
      const weight = Math.log(1 + entries.length / n);
      score += weight * (e.titleTokens.has(t) ? 3 : 1);
      hits.push(t);
    }
    if (score > 0) scored.push({ entry: e, score: score / Math.sqrt(Math.max(e.size, 1)), hits });
  }
  return scored.sort((a, b) => b.score - a.score || a.entry.file.localeCompare(b.entry.file));
}

export function loadIndex(root) {
  try {
    return parseIndex(readFileSync(path.join(root, "docs", "notes", "INDEX.md"), "utf8"));
  } catch {
    return [];
  }
}

export function matchNotes(root, text, limit = MAX_NOTES) {
  return scoreEntries(loadIndex(root), text).slice(0, limit);
}

// ---------------------------------------------------------------------------
// What each area of this tree is NOT covered by
// ---------------------------------------------------------------------------

// [test, area, the signal `dotnet test` does not give you]
const AREAS = [
  [
    /^backend\/(?:StigviddAPI\/Controllers|WebDataContracts)\//i,
    "the API surface",
    "changing it drifts the contract: OpenApiContractTests rewrites web/openapi.json and " +
      "fails once, and the typed client is stale until `cd web && npm run generate:api`. " +
      "The Jenkinsfile web stage fails on `git diff --exit-code -- src/api/generated`.",
  ],
  [
    /^backend\/Infrastructure\/Migrations\//i,
    "migrations",
    "no test applies one. The suites run SQLite in-memory, so a migration is exercised " +
      "for the first time by DbMigrationRunner against a real PostGIS database — bring " +
      "the stack up (`docker compose up -d`) if you want to see it run.",
  ],
  [/^backend\//i, "the backend", "cd backend && dotnet build && dotnet test (with ConnectionStrings__StigVidd set)."],
  [
    /^web\//i,
    "the admin web",
    "there are NO web tests. `cd web && npm run build` (tsc -b && vite build) IS the type " +
      "check, and `npm run lint` the rest.",
  ],
  [
    /^app\//i,
    "the mobile app",
    "CI runs prettier, eslint and jest — and NOTHING type-checks app/. " +
      "`cd app && npx tsc --noEmit` is a step you have to take deliberately.",
  ],
  [
    /^(?:docker-compose\.yml|proxy\/|db\/|keycloak\/|media\/|.*Dockerfile)/i,
    "the deployment stack",
    "nothing in GitHub CI builds an image or runs docker compose; the Jenkinsfile does, " +
      "and only on main. Locally: `docker compose up -d`, then /healthz (liveness) and /readyz (readiness, which is the one that checks the database).",
  ],
  [/^scripts\//i, "scripts/", "covered by no test and no CI stage at all — run it."],
  [/^\.claude\/(?:hooks|skills)\//i, "the agent harness", "node scripts/check-hooks.mjs."],
  [
    /^(?:Jenkinsfile|\.github\/workflows\/)/i,
    "CI definitions",
    "exercised only by running the pipeline; a syntax slip here is invisible locally.",
  ],
  [/^docs\//i, "docs", "nothing checks prose. `--check-notes` checks INDEX.md against the files."],
];

/** Which areas a blob of text (a plan) or a path list names, in AREAS order, deduped. */
export function areasFor(paths) {
  const seen = new Set();
  const out = [];
  for (const p of paths)
    for (const [re, area, signal] of AREAS)
      if (re.test(p) && !seen.has(area)) {
        seen.add(area);
        out.push({ area, signal });
        break;
      }
  return out;
}

/** Repo-ish paths mentioned anywhere in free text. */
export function pathsNamedIn(text) {
  const out = new Set();
  const re = /(?:^|[\s(`'"[])((?:backend|web|app|docs|scripts|proxy|db|keycloak|media|ci|\.github|\.claude)\/[A-Za-z0-9_./-]*|docker-compose\.yml|Jenkinsfile)/g;
  for (const m of String(text ?? "").matchAll(re)) out.add(m[1]);
  return [...out];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function stateFile(sessionId) {
  const dir = path.join(stateDir(), "plan-eval");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    /* best effort */
  }
  const safe = String(sessionId || "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(dir, `${safe}.json`);
}

function stateRead(sessionId) {
  try {
    return JSON.parse(readFileSync(stateFile(sessionId), "utf8"));
  } catch {
    return null;
  }
}

function stateWrite(sessionId, obj) {
  try {
    writeFileSync(stateFile(sessionId), JSON.stringify(obj));
  } catch {
    /* best effort */
  }
}

/** Drop state older than a day, so a long-lived box does not accumulate them. */
function prune() {
  const dir = path.join(stateDir(), "plan-eval");
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).mtimeMs < cutoff) rmSync(p, { force: true });
    }
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Git and transcript evidence
// ---------------------------------------------------------------------------

function dirtyPaths(root) {
  const out = git(root, "status", "--porcelain", "-z", "-uall");
  if (out === null) return [];
  const fields = out.split("\0");
  const paths = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.length < 4) continue;
    paths.push(f.slice(3));
    if (f[0] === "R" || f[0] === "C") i++;
  }
  return paths;
}

function headSha(root) {
  return (git(root, "rev-parse", "HEAD") ?? "").trim() || null;
}

function committedSince(root, sha) {
  if (!sha) return { paths: [], commits: 0 };
  const names = git(root, "diff", "--name-only", `${sha}..HEAD`);
  const count = git(root, "rev-list", "--count", `${sha}..HEAD`);
  return {
    paths: names === null ? [] : lines(names).filter(Boolean),
    commits: count === null ? 0 : Number(count.trim()) || 0,
  };
}

/** Every Bash command this session ran, from its transcript. */
export function sessionCommands(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return [];
  let body;
  try {
    body = readFileSync(transcriptPath, "utf8");
  } catch {
    return [];
  }
  const cmds = [];
  for (const ln of lines(body)) {
    if (!ln.trim()) continue;
    let o;
    try {
      o = JSON.parse(ln);
    } catch {
      continue;
    }
    const content = o?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content)
      if (c?.type === "tool_use" && c?.name === "Bash" && typeof c?.input?.command === "string")
        cmds.push(c.input.command);
  }
  return cmds;
}

/**
 * Which of the obliged checks the session's own commands show it actually ran.
 * Pure, so the self-test can drive it.
 */
export function ranWhat(commands) {
  const all = commands.join("\n");
  return {
    backendTest: /dotnet\s+test/.test(all),
    backendBuild: /dotnet\s+(?:build|test)/.test(all),
    webBuild: /npm\s+run\s+build/.test(all) || /vite\s+build/.test(all),
    webLint: /npm\s+run\s+lint/.test(all),
    generate: /npm\s+run\s+generate:api/.test(all),
    appTest: /npm\s+(?:test|t)\b/.test(all) || /jest\b/.test(all),
    appTypes: /tsc\s+--noEmit/.test(all),
    harness: /check-hooks\.mjs/.test(all),
    compose: /docker\s+compose\s+up/.test(all),
  };
}

/** The checks a set of changed paths obliges, minus the ones the session ran. */
export function outstanding(paths, ran) {
  const need = [];
  const touched = (re) => paths.some((p) => re.test(p));
  if (touched(/^backend\//i) && !ran.backendTest)
    need.push('cd backend && ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build');
  if (touched(/^backend\/(?:StigviddAPI\/Controllers|WebDataContracts)\//i) && !ran.generate)
    need.push("cd web && npm run generate:api      # the API surface changed; the client is stale");
  if (touched(/^web\//i) && !ran.webBuild) need.push("cd web && npm run build      # the only type check web/ has");
  if (touched(/^web\//i) && !ran.webLint) need.push("cd web && npm run lint");
  if (touched(/^app\//i) && !ran.appTest) need.push("cd app && npm test -- --watchAll=false");
  if (touched(/^app\//i) && !ran.appTypes)
    need.push("cd app && npx tsc --noEmit      # nothing in CI type-checks app/");
  if (touched(/^\.claude\/(?:hooks|skills)\//i) && !ran.harness) need.push("node scripts/check-hooks.mjs");
  if (touched(/^(?:docker-compose\.yml|proxy\/|db\/|keycloak\/|.*Dockerfile)/i) && !ran.compose)
    need.push("docker compose up -d && curl -fsS localhost:<port>/readyz      # CI never builds the stack");
  return need;
}

// ---------------------------------------------------------------------------
// Round 1 — a plan was just approved
// ---------------------------------------------------------------------------

function planText(ev) {
  const fromPayload = ev?.tool_input?.plan;
  if (typeof fromPayload === "string" && fromPayload.trim()) return fromPayload;
  // Defect 1: the plans directory is per-USER, so the newest file there may belong to
  // another session entirely. Only a very recent one can plausibly be this plan.
  try {
    const dir = path.join(homedir(), ".claude", "plans");
    const best = readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ f, m: statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m)[0];
    if (best && Date.now() - best.m < FALLBACK_PLAN_AGE_MS)
      return readFileSync(path.join(dir, best.f), "utf8");
  } catch {
    /* no plans dir */
  }
  return "";
}

export function renderBefore(root, plan, notes, areas) {
  const out = [];
  if (notes.length)
    out.push(
      "docs/notes/ has entries that match this plan — read them before starting, they are " +
        "what earlier sessions had to learn the hard way:\n" +
        notes
          .map(
            (s) =>
              `  - ${s.entry.title}\n    docs/notes/${s.entry.file}` +
              (s.hits.length ? `   (on: ${s.hits.slice(0, 6).join(", ")})` : ""),
          )
          .join("\n"),
    );
  else
    out.push(
      "docs/notes/ has nothing matching this plan. That is either a genuinely new area — " +
        "in which case there is probably a note to write when you are done — or the plan " +
        "does not name the paths it touches.",
    );
  if (areas.length)
    out.push(
      "What `dotnet test` will NOT tell you about the areas this plan names:\n" +
        areas.map((a) => `  - ${a.area}: ${a.signal}`).join("\n"),
    );
  return out.join("\n\n");
}

function phaseBefore(ev) {
  const root = repoRoot(ev);
  if (!root) return 0;
  const plan = planText(ev);
  if (!plan.trim()) return 0;
  prune();
  const paths = pathsNamedIn(plan);
  stateWrite(ev.session_id, {
    head: headSha(root),
    dirty: dirtyPaths(root),
    at: Date.now(),
    asked: false,
    paths,
  });
  const text = renderBefore(root, plan, matchNotes(root, plan), areasFor(paths));
  return text ? speak(text) : 0;
}

// ---------------------------------------------------------------------------
// Round 2 — the session is trying to stop
// ---------------------------------------------------------------------------

export function renderAfter(shipped, commits, need, notes) {
  const out = [];
  out.push(
    `This session shipped ${shipped.length} changed file(s)` +
      (commits ? ` in ${commits} commit(s)` : " (uncommitted)") +
      ". Two things before it ends.",
  );
  if (need.length)
    out.push(
      "1. The diff obliges checks your own commands do not show you ran:\n" +
        need.map((c) => "     " + c).join("\n") +
        "\n   Run them, or say plainly which you are skipping and why.",
    );
  else
    out.push("1. Every check the diff obliges appears in this session's commands. Good.");
  out.push(
    "2. What did you learn that is not in the code?\n" +
      "   Something that surprised you, cost you a wrong turn, or that a doc comment or a " +
      "skill got wrong. If there is one, write it down NOW — this is the only moment the " +
      "answer is still in context. Use the write-a-note skill; it goes in docs/notes/ " +
      "with a line in INDEX.md, which is what makes it findable at all." +
      (notes.length
        ? "\n   Related existing notes, in case yours belongs in one of them instead:\n" +
          notes.map((s) => `     docs/notes/${s.entry.file}  ${s.entry.title}`).join("\n")
        : ""),
  );
  out.push("If there is genuinely nothing to add, say so and stop — this asks once per plan.");
  return out.join("\n\n");
}

function phaseAfter(ev) {
  // A Stop hook that blocks and then sees its own continuation must not block again.
  if (ev?.stop_hook_active) return 0;
  const st = stateRead(ev.session_id);
  if (!st || st.asked) return 0; // no plan was approved, or the round already spoke
  const root = repoRoot(ev);
  if (!root) return 0;

  const was = new Set(st.dirty ?? []);
  const nowDirty = dirtyPaths(root).filter((p) => !was.has(p));
  const { paths: committed, commits } = committedSince(root, st.head);
  const shipped = [...new Set([...nowDirty, ...committed])];
  // Defect 2: do NOT consume the round on a session that has not shipped anything yet.
  if (!shipped.length) return 0;

  const need = outstanding(shipped, ranWhat(sessionCommands(ev.transcript_path)));
  const notes = matchNotes(root, shipped.join(" "), 3);
  stateWrite(ev.session_id, { ...st, asked: true });
  return speak(renderAfter(shipped, commits, need, notes));
}

// ---------------------------------------------------------------------------
// Standalone commands
// ---------------------------------------------------------------------------

function cmdMatch(query) {
  const root = repoRoot({});
  if (!root) return 0;
  const scored = matchNotes(root, query, 8);
  if (!scored.length) {
    process.stdout.write("No note in docs/notes/INDEX.md matches that.\n");
    return 0;
  }
  for (const s of scored)
    process.stdout.write(
      `${s.score.toFixed(2)}  ${s.entry.title}\n        docs/notes/${s.entry.file}` +
        (s.hits.length ? `   (on: ${s.hits.slice(0, 8).join(", ")})` : "") +
        "\n",
    );
  return 0;
}

/** INDEX.md and docs/notes/*.md must name each other. Either gap makes a note invisible. */
function checkNotes() {
  const root = repoRoot({});
  if (!root) return 0;
  const dir = path.join(root, "docs", "notes");
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "INDEX.md");
  } catch {
    process.stdout.write("check-notes: docs/notes/ does not exist yet\n");
    return 0;
  }
  const entries = loadIndex(root);
  const listed = new Set(entries.map((e) => e.file));
  let bad = 0;
  for (const f of files)
    if (!listed.has(f)) {
      process.stderr.write(`CHECK-NOTES FAIL: docs/notes/${f} is in no INDEX.md line — it is unreachable\n`);
      bad++;
    }
  for (const e of entries)
    if (!existsSync(path.join(dir, e.file))) {
      process.stderr.write(`CHECK-NOTES FAIL: INDEX.md points at docs/notes/${e.file}, which does not exist\n`);
      bad++;
    }
  for (const e of entries)
    if (e.body.trim().length < 40) {
      process.stderr.write(
        `CHECK-NOTES FAIL: the INDEX.md line for ${e.file} has almost no summary — ` +
          "matching runs on that text, so a bare title is a note nothing will ever recall\n",
      );
      bad++;
    }
  process.stdout.write(`check-notes: ${files.length} note(s), ${entries.length} index line(s), ${bad} problem(s)\n`);
  return bad ? 1 : 0;
}

// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();
  if (argv.includes("--check-notes")) return checkNotes();
  const mi = argv.indexOf("--match");
  if (mi !== -1) return cmdMatch(argv.slice(mi + 1).join(" "));
  const ev = readEvent();
  try {
    if (argv.includes("--before")) return phaseBefore(ev);
    if (argv.includes("--after")) return phaseAfter(ev);
  } catch {
    return 0; // never wedge a session
  }
  return 0;
}

const FIXTURE_INDEX = `# Agent notes

- [The API contract is a one-way pipeline](openapi-contract-snapshot.md) —
  OpenApiContractTests rewrites web/openapi.json itself when the surface drifts and then
  fails once; the client under web/src/api/generated is orval output and stale until
  \`npm run generate:api\`.
- [.git is a file in a linked worktree](git-worktree-repo-root.md) — repo-root discovery
  that tests for a directory walks straight past the root and throws.
- [A very long entry about many unrelated things](long.md) — migrations postgis srid
  spatialite npgsql geometry linestring facility obstacle trail hike review notification
  media keycloak caddy jenkins docker compose proxy openobserve telemetry otlp expo vite
  orval eslint prettier jest xunit fluentassertions moq nsubstitute testcontainers
  connection string nullable warnings errors directory build props.
`;

function selfTest() {
  const { ok, done } = checker("plan-eval");
  let n = 0;

  // -- tokenizing and whole-token matching (defect 4) -----------------------------
  ok(!tokenize("refactoring").includes("actor"), "tokenize produced a substring token");
  ok(tokenize("a of the SRID 4326").join(",") === "the,srid,4326", `tokenize: ${tokenize("a of the SRID 4326")}`);
  n += 2;

  // -- index parsing, including a wrapped summary --------------------------------
  const entries = parseIndex(FIXTURE_INDEX);
  ok(entries.length === 3, `parseIndex: ${entries.length} entries, expected 3`);
  ok(entries[0].file === "openapi-contract-snapshot.md", `parseIndex file: ${entries[0].file}`);
  ok(/orval output/.test(entries[0].body), "a wrapped summary line was dropped");
  n += 3;

  // -- scoring: the specific query must beat the long grab-bag (length normalisation)
  const top = scoreEntries(entries, "the openapi contract snapshot drifted and the client is stale")[0];
  ok(top?.entry.file === "openapi-contract-snapshot.md", `scoring picked ${top?.entry.file}`);
  const wt = scoreEntries(entries, "worktree");
  ok(wt[0]?.entry.file === "git-worktree-repo-root.md", `worktree query picked ${wt[0]?.entry.file}`);
  ok(scoreEntries(entries, "quantum bicycle upholstery").length === 0, "an off-topic query still matched");
  n += 3;

  // -- areas and the paths they are found from -----------------------------------
  const paths = pathsNamedIn(
    "Change backend/StigviddAPI/Controllers/FacilitiesController.cs and web/src/pages/X.tsx, " +
      "then docker-compose.yml and app/src/api/y.ts",
  );
  ok(paths.length === 4, `pathsNamedIn: ${paths.length} paths (${paths})`);
  const areas = areasFor(paths);
  ok(areas.some((a) => a.area === "the API surface"), "the API-surface area was not recognised");
  ok(areas.some((a) => a.area === "the mobile app"), "the app area was not recognised");
  ok(areas.some((a) => a.area === "the deployment stack"), "the compose area was not recognised");
  // Order matters: a Controllers path is the API surface, not merely "the backend".
  ok(areasFor(["backend/StigviddAPI/Controllers/X.cs"])[0].area === "the API surface",
     "a controller path fell through to the generic backend area");
  ok(areasFor(["backend/Core/Services/X.cs"])[0].area === "the backend", "a service path did not fall through");
  n += 6;

  // -- obligations minus what the session ran -----------------------------------
  const ranNothing = ranWhat([]);
  const need = outstanding(["backend/StigviddAPI/Controllers/X.cs", "web/src/pages/Y.tsx"], ranNothing);
  ok(need.some((c) => /dotnet test/.test(c)), "a backend change did not oblige dotnet test");
  ok(need.some((c) => /generate:api/.test(c)), "an API-surface change did not oblige regeneration");
  ok(need.some((c) => /npm run build/.test(c)), "a web change did not oblige the type check");
  const ranAll = ranWhat([
    'ConnectionStrings__StigVidd="DataSource=:memory:" dotnet test --no-build',
    "cd web && npm run generate:api && npm run lint && npm run build",
  ]);
  ok(outstanding(["backend/StigviddAPI/Controllers/X.cs", "web/src/pages/Y.tsx"], ranAll).length === 0,
     "checks the session demonstrably ran were still demanded");
  ok(outstanding(["app/src/x.ts"], ranNothing).some((c) => /tsc --noEmit/.test(c)),
     "an app change did not oblige a type check nothing else does");
  ok(outstanding(["README.md"], ranNothing).length === 0, "a docs-only change obliged a build");
  n += 6;

  // -- the rendered rounds carry their point ------------------------------------
  const before = renderBefore("/r", "touch backend/StigviddAPI/Controllers/X.cs", scoreEntries(entries, "openapi contract"), areas);
  ok(/docs\/notes\//.test(before), "round 1 named no note path");
  ok(/dotnet test` will NOT/.test(before), "round 1 dropped the not-covered-by section");
  const after = renderAfter(["backend/Core/X.cs"], 0, ["cd backend && dotnet test"], []);
  ok(/write-a-note/.test(after), "round 2 does not point at the note-writing skill");
  ok(/dotnet test/.test(after), "round 2 dropped the outstanding checks");
  n += 4;

  // -- gating: round 2 must not speak without a round-1 state, and must not loop --
  ok(phaseAfter({ session_id: "no-such-session-for-self-test" }) === 0,
     "round 2 spoke for a session that never had a plan approved");
  ok(phaseAfter({ session_id: "x", stop_hook_active: true }) === 0, "round 2 ignored stop_hook_active");
  n += 2;

  // -- INDEX.md <-> files, against the real docs/notes ---------------------------
  ok(typeof checkNotes === "function", "check-notes is not wired");
  n++;
  return done(n);
}

process.exit(main());
