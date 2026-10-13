#!/usr/bin/env node
// Recall and retro: what makes the next session cheaper than this one.
//
//   --prompt  UserPromptSubmit — matches the prompt against docs/notes/INDEX.md and injects
//             at most 3 notes not already shown this session. Silent on no match. This is
//             the recall a session without a plan otherwise never gets.
//   --before  PostToolUse on ExitPlanMode — the moment a plan is APPROVED. A rejected
//             plan makes ExitPlanMode return an error, so PostToolUse never runs and this
//             stays silent: approval is the trigger, not the attempt. It answers two
//             things the session would otherwise have to think to ask for: the docs/notes/
//             entries that match this plan, and, for each area of the tree the plan names,
//             THE SIGNAL `dotnet test` DOES NOT GIVE YOU. It marks the session as a plan
//             session on the baseline (HEAD + already-dirty paths) that session-start.mjs
//             wrote, so round 2 can tell this session's work from what the tree carried.
//   --after   Stop. Speaks ONCE, for a session that shipped files and either had a plan
//             approved or made >= RETRO_MIN_CALLS tool calls. It reports what the diff
//             obliges minus what the session's commands show it ran, and what the session
//             COST, measured from its own transcript (calls before the first edit, reads via
//             Bash vs CodeGraph, re-read files, edits that bypassed the Edit guards, notes
//             shown vs opened). Then it asks where the fact that would have skipped the
//             biggest cost belongs, and appends the numbers to the retro ledger.
//
// Outside the hook path:
//
//     node .claude/hooks/plan-eval.mjs --match "<words, a task, a paragraph>"
//     node .claude/hooks/plan-eval.mjs --report          # the trend, and notes to promote
//     node .claude/hooks/plan-eval.mjs --backfill [dir]  # seed the ledger from old transcripts
//     node .claude/hooks/plan-eval.mjs --check-notes     # INDEX.md <-> the files
//     node .claude/hooks/plan-eval.mjs --self-test
//
// THE LEDGER is machine-local (the git common dir, see ledgerPath() in lib.mjs) and exists
// so the cycle can be judged by numbers rather than by how its prose reads: if calls before
// the first edit do not fall over the weeks, the notes are not doing their job. A note
// opened in >= 3 sessions is a PROMOTION CANDIDATE — a rule every session pays to re-read
// belongs in CLAUDE.md, a skill or a hook, where it costs nothing to find.
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
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import {
  readEvent,
  repoRoot,
  git,
  lines,
  speak,
  inject,
  checker,
  commandsIn,
  readSessionState,
  writeSessionState,
  pruneSessionState,
  ensureBaseline,
  dirtyPaths,
  ledgerPath,
} from "./lib.mjs";

// Every note a match names is one the session goes and reads, so a weak match is not free:
// at most 3, each within half the top score, each on >= 2 distinct tokens.
const MAX_NOTES = 3;
const MIN_RELATIVE_SCORE = 0.5;
const FALLBACK_PLAN_AGE_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

// Words any plan contains. The document-frequency ceiling below misses them because the
// index is small; measured, "this", "before" and "session" alone matched four notes.
const STOPWORDS = new Set(
  ("the and for with this that these those from into onto than then when what which who why how " +
    "was were are been being has have had not but its they them their there here also " +
    "only just once twice same such each every any all both either other another more most less " +
    "very much many some one two three first last new old add adds added fix fixed get set use " +
    "used uses using make made run runs ran see says said per plus via before after already about " +
    "must can could should would will may might does did done thing things way ways part case " +
    "keep kept line lines name names change changes changed step steps plan note notes session " +
    "claude repo project measured rule rules because instead still even back out off over under " +
    "update updates code file files path paths form you your").split(" "),
);

export function tokenize(text) {
  const out = [];
  for (const t of String(text ?? "").toLowerCase().split(/[^a-z0-9]+/))
    if (t.length >= 3 && !STOPWORDS.has(t)) out.push(t);
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
  const minHits = Math.min(2, qs.size);
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
    if (hits.length >= minHits) scored.push({ entry: e, score: score / Math.sqrt(Math.max(e.size, 1)), hits });
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
  const scored = scoreEntries(loadIndex(root), text);
  const floor = (scored[0]?.score ?? 0) * MIN_RELATIVE_SCORE;
  return scored.filter((s) => s.score >= floor).slice(0, limit);
}

// ---------------------------------------------------------------------------
// What each area of this tree is NOT covered by
// ---------------------------------------------------------------------------

// [test, area, the signal `dotnet test` does not give you]
const AREAS = [
  [
    /^backend\/(?:StigviddAPI\/Controllers|WebDataContracts)\//i,
    "the API surface",
    "changing it drifts the contract: the StigviddAPI build exports web/openapi.json " +
      "(gitignored, so `dotnet build` is what produces it), and the typed client is stale " +
      "until `cd web && npm run generate:api` — which `cd web && npm run build` now does " +
      "for you. The typed client IS committed, and the Jenkinsfile web stage fails on " +
      "`git diff --exit-code -- src/api/generated`.",
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
    "`cd web && npm test` is Vitest (`vitest run`, configured in web/vitest.config.ts, NOT " +
      "vite.config.ts) and it TYPE-CHECKS NOTHING — `cd web && npm run build` (tsc -b && " +
      "vite build) is the type check, and `npm run lint` the rest. All three run in the " +
      "GitHub web job; the generated-client staleness gate is Jenkins only.",
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
// Git and transcript evidence
// ---------------------------------------------------------------------------

function committedSince(root, sha) {
  if (!sha) return { paths: [], commits: 0 };
  const names = git(root, "diff", "--name-only", `${sha}..HEAD`);
  const count = git(root, "rev-list", "--count", `${sha}..HEAD`);
  return {
    paths: names === null ? [] : lines(names).filter(Boolean),
    commits: count === null ? 0 : Number(count.trim()) || 0,
  };
}

function transcriptLines(transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return [];
  try {
    return lines(readFileSync(transcriptPath, "utf8"));
  } catch {
    return [];
  }
}

/** Every Bash command this session ran, from its transcript. */
export function sessionCommands(transcriptPath) {
  return sessionStats(transcriptLines(transcriptPath)).commands;
}

// ---------------------------------------------------------------------------
// What the session cost, measured from its own transcript
// ---------------------------------------------------------------------------

// Below this, a session that shipped is a quick fix and a retro costs more than it returns.
export const RETRO_MIN_CALLS = 15;
// A note opened in this many sessions is paid for again by each one: promote its rule.
const PROMOTE_AT = 3;

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const READ_HEADS = /^(?:sed|cat|head|tail|less|grep|egrep|rg|find|ls|awk|wc|tree)$/;
const FILE_READ_HEADS = /^(?:sed|cat|head|tail|less)$/;
const SCRIPT_HEADS = /^(?:python3?|py|perl|node|ruby)$/;
const WRITES_IN_SCRIPT =
  /open\([^)]*,\s*['"][wa]b?\+?['"]|\.write_text\(|\.write_bytes\(|writeFileSync|appendFileSync/;
const IN_PLACE = /\s-[a-zA-Z]*i\b/;
// Output that is not the repo: a redirect there is plumbing, not an edit.
const NOT_REPO = /^(?:\/tmp\/|\/dev\/|\$|%TEMP%|''$)|\/scratchpad\/|\/\.claude\/plans\//;
// Hook output that recalls notes. The round-2 text names notes too, and must not count.
const SHOWN_MARKER = /docs\/notes\/ has entries that match|docs\/notes\/ entries for this prompt/;
const NOTE_FILE = /docs\/notes\/([A-Za-z0-9_.-]+\.md)/g;

const noteNames = (text) =>
  [...String(text).replace(/\\/g, "/").matchAll(NOTE_FILE)].map((m) => m[1]).filter((f) => f !== "INDEX.md");

const headOf = (seg) => {
  const first = seg.split(/[|;&\n]/, 1)[0];
  const head = first.split(/\s+/, 1)[0].replace(/\\/g, "/").split("/").pop() ?? "";
  return { first, head };
};

/** A heredoc's body is data, not commands or redirects. */
const stripHeredocs = (cmd) =>
  String(cmd).replace(/<<-?\s*(['"]?)([A-Za-z_]+)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, "<<HEREDOC");

/** Files a command writes by redirect (`>`, `>>`, `tee`), heredoc bodies and quotes ignored. */
export function redirectTargets(cmd) {
  const s = stripHeredocs(cmd).replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, "''");
  const out = [];
  for (const m of s.matchAll(/>>?\s*([^\s&|;<>()]+)/g)) out.push(m[1]);
  for (const m of s.matchAll(/\btee\s+(?:-a\s+)?([^\s&|;<>()-][^\s&|;<>()]*)/g)) out.push(m[1]);
  return out.filter((t) => !NOT_REPO.test(t.replace(/\\/g, "/")));
}

/**
 * True when a Bash command rewrites a file: sed/perl -i, a script that opens a file for
 * writing, or a redirect into the repo. Every one of those skips the PreToolUse Edit guards
 * and the PostToolUse build and lint — which is why the retro counts them.
 */
export function isBashEdit(cmd) {
  for (const seg of commandsIn(stripHeredocs(cmd))) {
    const { first, head } = headOf(seg);
    if ((head === "sed" || head === "perl") && IN_PLACE.test(first)) return true;
    // The script's source may sit in a heredoc; the interpreter must not.
    if (SCRIPT_HEADS.test(head) && WRITES_IN_SCRIPT.test(cmd)) return true;
  }
  return redirectTargets(cmd).length > 0;
}

/** Whether a Bash command reads code, which files it reads, and whether it asks CodeGraph. */
export function bashRead(cmd) {
  let read = false;
  let codegraph = false;
  const files = [];
  for (const seg of commandsIn(stripHeredocs(cmd))) {
    const { first, head } = headOf(seg);
    if (head === "codegraph") codegraph = true;
    if (!READ_HEADS.test(head) || ((head === "sed" || head === "perl") && IN_PLACE.test(first))) continue;
    read = true;
    if (!FILE_READ_HEADS.test(head)) continue;
    for (const tok of first.split(/\s+/).slice(1)) {
      const t = tok.replace(/^['"]|['"]$/g, "");
      if (!t.startsWith("-") && /[A-Za-z0-9_]\.[A-Za-z0-9]{1,6}$/.test(t) && !NOT_REPO.test(t)) files.push(t);
    }
  }
  return { read, codegraph, files };
}

/** The last two path segments: enough to name a file, and the same however it was reached. */
const fileKey = (p) => String(p).replace(/\\/g, "/").split("/").filter(Boolean).slice(-2).join("/");

/**
 * The session's cost, from its transcript lines. Pure, so the self-test and --backfill can
 * drive it. `preEdit` counts the calls before the first change to the repo, through Edit or
 * through Bash — a plan file, a scratchpad file or a memory file is not one.
 */
export function sessionStats(transcript) {
  const st = { calls: 0, preEdit: null, plans: 0, codegraph: 0, bashReads: 0, bashEdits: 0, refused: 0 };
  const commands = [];
  const reads = new Map();
  const shown = new Set();
  const opened = new Set();
  const written = new Set();
  let date = null;
  const markEdit = () => {
    if (st.preEdit === null) st.preEdit = st.calls - 1;
  };
  const markRead = (f) => reads.set(fileKey(f), (reads.get(fileKey(f)) ?? 0) + 1);

  for (const ln of transcript) {
    if (!ln.trim()) continue;
    let o;
    try {
      o = JSON.parse(ln);
    } catch {
      continue;
    }
    if (!date && typeof o?.timestamp === "string") date = o.timestamp.slice(0, 10);
    if (o?.type === "attachment") {
      const t = JSON.stringify(o.attachment ?? "");
      if (SHOWN_MARKER.test(t)) for (const n of noteNames(t)) shown.add(n);
      continue;
    }
    const content = o?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (c?.type === "tool_result" && c.is_error) {
        const t = typeof c.content === "string" ? c.content : JSON.stringify(c.content ?? "");
        // A command's own exit status and the user declining are not refusals by the harness.
        if (!/^(?:Exit code|The user doesn't want|Tool permission request failed|<tool_use_error>)/.test(t))
          st.refused++;
        continue;
      }
      if (c?.type !== "tool_use") continue;
      st.calls++;
      const name = String(c.name ?? "");
      const input = c.input ?? {};
      if (/codegraph/i.test(name)) st.codegraph++;
      if (name === "ExitPlanMode") st.plans++;
      if (EDIT_TOOLS.has(name)) {
        const fp = String(input.file_path ?? input.notebook_path ?? "").replace(/\\/g, "/");
        if (!/\/\.claude\/plans\/|\/scratchpad\/|\/\.claude\/projects\/[^/]+\/memory\//.test(fp)) markEdit();
        for (const n of noteNames(fp)) written.add(n);
      }
      if (name === "Read" && input.file_path) {
        markRead(input.file_path);
        for (const n of noteNames(input.file_path)) opened.add(n);
      }
      if (name === "Bash" && typeof input.command === "string") {
        const cmd = input.command;
        commands.push(cmd);
        const r = bashRead(cmd);
        if (r.codegraph) st.codegraph++;
        if (isBashEdit(cmd)) {
          st.bashEdits++;
          markEdit();
          for (const t of redirectTargets(cmd)) for (const n of noteNames(t)) written.add(n);
        } else if (r.read) {
          st.bashReads++;
          r.files.forEach(markRead);
          for (const n of noteNames(stripHeredocs(cmd))) opened.add(n);
        }
      }
    }
  }
  if (st.preEdit === null) st.preEdit = st.calls;
  const rereads = [...reads]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([file, count]) => ({ file, count }));
  return { ...st, date, commands, rereads, shown: [...shown], opened: [...opened], written: [...written] };
}

// ---------------------------------------------------------------------------
// The ledger, and what it says over many sessions
// ---------------------------------------------------------------------------

export function ledgerRecord(session, plan, stats) {
  const { calls, preEdit, codegraph, bashReads, bashEdits, refused, rereads, shown, opened, written } = stats;
  return {
    date: stats.date ?? new Date().toISOString().slice(0, 10),
    session,
    plan: !!plan,
    calls,
    preEdit,
    codegraph,
    bashReads,
    bashEdits,
    refused,
    rereads,
    shown,
    opened,
    written,
  };
}

function readLedger(root) {
  const p = ledgerPath(root);
  if (!p || !existsSync(p)) return [];
  // Keyed by session, last line wins: a backfilled session that later gets its live round.
  const bySession = new Map();
  for (const ln of lines(readFileSync(p, "utf8"))) {
    try {
      if (!ln.trim()) continue;
      const r = JSON.parse(ln);
      bySession.set(r.session ?? bySession.size, r);
    } catch {
      /* a torn line is skipped, not fatal */
    }
  }
  return [...bySession.values()];
}

function appendLedger(root, records) {
  const p = ledgerPath(root);
  if (!p || !records.length) return;
  try {
    appendFileSync(p, records.map((r) => JSON.stringify(r)).join("\n") + "\n");
  } catch {
    /* best effort */
  }
}

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Monday of the record's ISO week, as YYYY-MM-DD. */
function weekOf(date) {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "unknown";
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** The weekly trend, the notes worth promoting, and the recalls nobody opened. Pure. */
export function summarize(records) {
  const weeks = new Map();
  const openedIn = new Map();
  const shownIn = new Map();
  for (const r of records) {
    const w = weekOf(r.date);
    const agg = weeks.get(w) ?? { week: w, n: 0, calls: [], preEdit: [], codegraph: 0, bashReads: 0, bashEdits: 0 };
    agg.n++;
    agg.calls.push(r.calls ?? 0);
    agg.preEdit.push(r.preEdit ?? 0);
    agg.codegraph += r.codegraph ?? 0;
    agg.bashReads += r.bashReads ?? 0;
    agg.bashEdits += r.bashEdits ?? 0;
    weeks.set(w, agg);
    for (const n of new Set(r.opened ?? [])) openedIn.set(n, (openedIn.get(n) ?? 0) + 1);
    for (const n of new Set(r.shown ?? [])) shownIn.set(n, (shownIn.get(n) ?? 0) + 1);
  }
  const trend = [...weeks.values()]
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((a) => ({ ...a, calls: median(a.calls), preEdit: median(a.preEdit) }));
  const promote = [...openedIn]
    .filter(([, n]) => n >= PROMOTE_AT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([note, sessions]) => ({ note, sessions }));
  const noisy = [...shownIn]
    .filter(([n, k]) => k >= PROMOTE_AT && !openedIn.has(n))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([note, shown]) => ({ note, shown }));
  return { sessions: records.length, trend, promote, noisy };
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
      "docs/notes/ has entries that match this plan — read the ones that bear on it; they are " +
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
  pruneSessionState();
  const paths = pathsNamedIn(plan);
  const notes = matchNotes(root, plan);
  // Keep the session-start baseline: work done before the plan is still this session's.
  const st = ensureBaseline(root, ev.session_id);
  writeSessionState(ev.session_id, {
    ...st,
    plan: true,
    paths,
    shown: [...new Set([...(st.shown ?? []), ...notes.map((s) => s.entry.file)])],
  });
  const text = renderBefore(root, plan, notes, areasFor(paths));
  return text ? speak(text) : 0;
}

// ---------------------------------------------------------------------------
// Every prompt — recall without a plan
// ---------------------------------------------------------------------------

export function renderPrompt(notes) {
  if (!notes.length) return "";
  return (
    "docs/notes/ entries for this prompt — open one only if it bears on the task:\n" +
    notes.map((s) => `  - ${s.entry.title}\n    docs/notes/${s.entry.file}`).join("\n")
  );
}

/** Notes matching the prompt that this session has not been shown yet. */
export function freshMatches(scored, shown) {
  const seen = new Set(shown ?? []);
  return scored.filter((s) => !seen.has(s.entry.file));
}

function phasePrompt(ev) {
  const root = repoRoot(ev);
  if (!root || typeof ev?.prompt !== "string" || !ev.prompt.trim()) return 0;
  const st = ensureBaseline(root, ev.session_id);
  const notes = freshMatches(matchNotes(root, ev.prompt), st.shown);
  if (!notes.length) return 0;
  writeSessionState(ev.session_id, { ...st, shown: [...(st.shown ?? []), ...notes.map((s) => s.entry.file)] });
  return inject(renderPrompt(notes), "UserPromptSubmit");
}

// ---------------------------------------------------------------------------
// Round 2 — the session is trying to stop
// ---------------------------------------------------------------------------

/** Whether round 2 speaks. Defect 2: never on a session that has not shipped anything yet. */
export function shouldAsk(st, stats, shipped) {
  if (!st || st.asked || !shipped.length) return false;
  return st.plan === true || stats.calls >= RETRO_MIN_CALLS;
}

/** The single most expensive thing the transcript shows, named so it can be answered. */
export function biggestSink(stats) {
  const top = stats.rereads[0];
  if (top && top.count >= 3 && top.count * 3 >= stats.preEdit)
    return `${top.file} was read ${top.count} times`;
  return `${stats.preEdit} tool calls went by before the first edit`;
}

export function renderAfter(shipped, commits, need, notes, stats, promote = 0) {
  const out = [];
  out.push(
    `This session shipped ${shipped.length} changed file(s)` +
      (commits ? ` in ${commits} commit(s)` : " (uncommitted)") +
      `. Cost: ${stats.calls} tool calls, ${stats.preEdit} before the first edit; code reads ` +
      `${stats.bashReads} via Bash, ${stats.codegraph} via CodeGraph` +
      (stats.refused ? `; ${stats.refused} call(s) refused by a hook or tool` : "") +
      (stats.rereads.length ? `. Re-read: ${stats.rereads.map((r) => `${r.file} x${r.count}`).join(", ")}` : "") +
      ".",
  );
  out.push(
    need.length
      ? "1. Checks the diff obliges that your commands do not show you ran:\n" +
          need.map((c) => "     " + c).join("\n") +
          "\n   Run them, or say plainly which you are skipping and why."
      : "1. Every check the diff obliges appears in this session's commands.",
  );
  out.push(
    `2. Cost — ${biggestSink(stats)}. What single fact would have let the next session skip ` +
      "that? Put it where finding it costs least: a CLAUDE.md line (always loaded) > a skill " +
      "step > a hook check > a docs/notes/ entry (write-a-note). Record the shortcut — the " +
      "path, symbol or command — not the story of the search.",
  );
  out.push(
    "3. Decisions — anything you would do differently from the start: a wrong approach, " +
      "rework, a question to the user that the repo already answered? A decision rule " +
      "belongs in the skill or CLAUDE.md section for that area.",
  );
  const unopened = stats.shown.filter((n) => !stats.opened.includes(n));
  out.push(
    "4. Recall — " +
      (unopened.length
        ? `shown but never opened: ${unopened.join(", ")}. If they did not bear on the task, ` +
          "tighten their INDEX.md lines. "
        : "") +
      "Was there a note you needed and were not offered? Fix its INDEX.md vocabulary and " +
      'prove it with `plan-eval.mjs --match "<this task>"`.' +
      (notes.length
        ? "\n   Existing notes near this diff, in case a new fact belongs in one of them:\n" +
          notes.map((s) => `     docs/notes/${s.entry.file}`).join("\n")
        : ""),
  );
  if (stats.bashEdits)
    out.push(
      `${stats.bashEdits} edit(s) went through Bash and skipped the Edit guards and the ` +
        "per-edit build and lint. Prefer Edit/Write.",
    );
  if (promote)
    out.push(
      `${promote} note(s) have been opened in ${PROMOTE_AT}+ sessions — promotion candidates: ` +
        "`node .claude/hooks/plan-eval.mjs --report`.",
    );
  out.push("Nothing to add? Say so in one line and stop — this asks once per session.");
  return out.join("\n\n");
}

function phaseAfter(ev) {
  // A Stop hook that blocks and then sees its own continuation must not block again.
  if (ev?.stop_hook_active) return 0;
  const st = readSessionState(ev.session_id);
  if (!st || st.asked) return 0; // no baseline, or the round already spoke
  const root = repoRoot(ev);
  if (!root) return 0;

  const was = new Set(st.dirty ?? []);
  const nowDirty = dirtyPaths(root).filter((p) => !was.has(p));
  const { paths: committed, commits } = committedSince(root, st.head);
  const shipped = [...new Set([...nowDirty, ...committed])];
  if (!shipped.length) return 0;

  const stats = sessionStats(transcriptLines(ev.transcript_path));
  if (!shouldAsk(st, stats, shipped)) return 0;

  const need = outstanding(shipped, ranWhat(stats.commands));
  const notes = matchNotes(root, shipped.join(" "), 3);
  const ledger = readLedger(root).filter((r) => r.session !== ev.session_id);
  const record = ledgerRecord(ev.session_id, st.plan, stats);
  appendLedger(root, [record]);
  writeSessionState(ev.session_id, { ...st, asked: true });
  return speak(renderAfter(shipped, commits, need, notes, stats, summarize([...ledger, record]).promote.length));
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

export function renderReport(sum, where) {
  const out = [`Retro ledger: ${sum.sessions} session(s) in ${where}`];
  if (!sum.sessions) {
    out.push("Empty. Seed it from this project's transcripts: plan-eval.mjs --backfill");
    return out.join("\n");
  }
  out.push("", "week of      sessions  median calls  median pre-edit  reads bash/codegraph  bash edits");
  for (const w of sum.trend)
    out.push(
      `${w.week}  ${String(w.n).padStart(8)}  ${String(w.calls).padStart(12)}  ${String(w.preEdit).padStart(15)}` +
        `  ${`${w.bashReads}/${w.codegraph}`.padStart(20)}  ${String(w.bashEdits).padStart(10)}`,
    );
  out.push(
    "",
    sum.promote.length
      ? `Promotion candidates — opened in ${PROMOTE_AT}+ sessions, so each session pays to re-read them. ` +
          "Move the rule into CLAUDE.md, a skill or a hook, then shrink the note to its evidence " +
          "(write-a-note, 'Promoting a note'):\n" +
          sum.promote.map((p) => `  ${String(p.sessions).padStart(3)}  docs/notes/${p.note}`).join("\n")
      : "No promotion candidates.",
  );
  if (sum.noisy.length)
    out.push(
      "",
      `Noisy recalls — shown ${PROMOTE_AT}+ times and never opened; their INDEX.md line is too broad:\n` +
        sum.noisy.map((p) => `  ${String(p.shown).padStart(3)}  docs/notes/${p.note}`).join("\n"),
    );
  return out.join("\n");
}

function cmdReport() {
  const root = repoRoot({});
  if (!root) return 0;
  process.stdout.write(renderReport(summarize(readLedger(root)), ledgerPath(root) ?? "(no git dir)") + "\n");
  return 0;
}

/** Claude Code's transcript directory for a checkout: the absolute path, non-alphanumerics as `-`. */
const transcriptDir = (root) => path.join(homedir(), ".claude", "projects", root.replace(/[^A-Za-z0-9]/g, "-"));

/**
 * Seed the ledger from transcripts that predate it, so the trend starts from a baseline and
 * not from zero. Idempotent per session id. Applies round 2's own size test; whether those
 * sessions shipped anything is no longer knowable, so that half is assumed.
 */
function cmdBackfill(dirArg) {
  const root = repoRoot({});
  if (!root) return 0;
  const dir = dirArg || transcriptDir(root);
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    process.stdout.write(`backfill: no transcripts in ${dir}\n`);
    return 0;
  }
  const have = new Set(readLedger(root).map((r) => r.session));
  const add = [];
  for (const f of files) {
    const session = f.replace(/\.jsonl$/, "");
    if (have.has(session)) continue;
    const stats = sessionStats(transcriptLines(path.join(dir, f)));
    if (stats.calls < RETRO_MIN_CALLS && !stats.plans) continue;
    add.push({ ...ledgerRecord(session, stats.plans > 0, stats), backfill: true });
  }
  add.sort((a, b) => a.date.localeCompare(b.date));
  appendLedger(root, add);
  process.stdout.write(`backfill: ${add.length} session(s) added from ${files.length} transcript(s) in ${dir}\n`);
  return 0;
}

/** Relative links in a note body that no longer resolve — the note may describe code that moved. */
export function deadLinks(noteDir, body) {
  const out = [];
  for (const m of String(body).matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)) {
    const target = m[1].split("#")[0];
    if (target && !existsSync(path.resolve(noteDir, decodeURI(target)))) out.push(target);
  }
  return out;
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
  // A warning, not a failure: a moved file is worth a look, not a red build.
  let stale = 0;
  for (const f of files) {
    let body = "";
    try {
      body = readFileSync(path.join(dir, f), "utf8");
    } catch {
      continue;
    }
    for (const t of deadLinks(dir, body)) {
      process.stderr.write(`check-notes: warning: docs/notes/${f} links ${t}, which no longer exists — stale?\n`);
      stale++;
    }
  }
  process.stdout.write(
    `check-notes: ${files.length} note(s), ${entries.length} index line(s), ${bad} problem(s)` +
      (stale ? `, ${stale} dead link(s)` : "") +
      "\n",
  );
  return bad ? 1 : 0;
}

// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest();
  if (argv.includes("--check-notes")) return checkNotes();
  if (argv.includes("--report")) return cmdReport();
  const bi = argv.indexOf("--backfill");
  if (bi !== -1) return cmdBackfill(argv[bi + 1]);
  const mi = argv.indexOf("--match");
  if (mi !== -1) return cmdMatch(argv.slice(mi + 1).join(" "));
  const ev = readEvent();
  try {
    if (argv.includes("--prompt")) return phasePrompt(ev);
    if (argv.includes("--before")) return phaseBefore(ev);
    if (argv.includes("--after")) return phaseAfter(ev);
  } catch {
    return 0; // never wedge a session
  }
  return 0;
}

const FIXTURE_INDEX = `# Agent notes

- [The API contract is a one-way pipeline](openapi-contract-snapshot.md) —
  the StigviddAPI build exports web/openapi.json when the surface drifts; the client under
  web/src/api/generated is orval output and stale until
  \`npm run generate:api\`.
- [.git is a file in a linked worktree](git-worktree-repo-root.md) — repo-root discovery
  that tests for a directory walks straight past the root and throws.
- [A very long entry about many unrelated things](long.md) — migrations postgis srid
  spatialite npgsql geometry linestring facility obstacle trail hike review notification
  media keycloak caddy jenkins docker compose proxy openobserve telemetry otlp expo vite
  orval eslint prettier jest xunit fluentassertions moq nsubstitute testcontainers
  connection string nullable warnings errors directory build props.
`;

// A transcript in the shape Claude Code writes: tool calls inside assistant messages, results
// inside user messages, hook output as `attachment` records.
const use = (name, input) => ({ type: "assistant", message: { content: [{ type: "tool_use", name, input }] } });
const res = (content, is_error = true) => ({ type: "user", message: { content: [{ type: "tool_result", content, is_error }] } });
const FIXTURE_TRANSCRIPT = [
  { type: "attachment", timestamp: "2026-10-01T08:00:00Z", attachment: { type: "hook_blocking_error",
    blockingError: "docs/notes/ has entries that match this plan:\n docs/notes/srid-4326.md\n docs/notes/spatialite-per-os.md" } },
  { type: "attachment", attachment: { type: "hook_success", content: "unrelated, mentions docs/notes/other.md" } },
  use("Read", { file_path: "/r/backend/Core/Services/TrailService.cs" }),
  use("Read", { file_path: "/r/backend/Core/Services/TrailService.cs", offset: 200 }),
  use("Bash", { command: "cd backend && sed -n '1,40p' Core/Services/TrailService.cs" }),
  use("mcp__codegraph__codegraph_explore", { query: "TrailService" }),
  use("Write", { file_path: "/home/u/.claude/plans/p.md", content: "plan" }),
  use("Bash", { command: "cat docs/notes/srid-4326.md | grep -n SRID" }),
  res("Exit code 1\nno match"),
  use("Bash", { command: "python3 - <<'EOF'\np='backend/X.cs'\ns=open(p).read()\nopen(p,'w').write(s)\nEOF" }),
  use("Bash", { command: "grep -rn FromLonLat backend/" }),
  use("Edit", { file_path: "/r/backend/X.cs", old_string: "a", new_string: "b" }),
  res("PreToolUse:Edit hook error: denied"),
].map((o) => JSON.stringify(o));

function selfTest() {
  const { ok, done } = checker("plan-eval");
  let n = 0;

  // -- tokenizing and whole-token matching (defect 4) -----------------------------
  ok(!tokenize("refactoring").includes("actor"), "tokenize produced a substring token");
  ok(tokenize("a of the SRID 4326").join(",") === "srid,4326", `tokenize: ${tokenize("a of the SRID 4326")}`);
  ok(tokenize("this session was measured before").length === 0, "stopwords reached the scorer");
  ok(scoreEntries(parseIndex(FIXTURE_INDEX), "openapi quantum").length === 0,
     "a single shared token matched a multi-token query");
  n += 4;

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
  const fixtureStats = sessionStats(FIXTURE_TRANSCRIPT);
  const after = renderAfter(["backend/Core/X.cs"], 0, ["cd backend && dotnet test"], [], fixtureStats, 2);
  ok(/write-a-note/.test(after), "round 2 does not point at the note-writing skill");
  ok(/dotnet test/.test(after), "round 2 dropped the outstanding checks");
  n += 4;

  // -- the transcript measurement -----------------------------------------------
  const s = fixtureStats;
  ok(s.calls === 9, `sessionStats: ${s.calls} calls, expected 9`);
  ok(s.preEdit === 6, `preEdit ${s.preEdit}, expected 6 — a plan-file write must not end the run`);
  ok(s.bashReads === 3, `bashReads ${s.bashReads}, expected 3 (sed -n, grep, cat)`);
  ok(s.codegraph === 1, `codegraph ${s.codegraph}, expected 1`);
  ok(s.bashEdits === 1, `bashEdits ${s.bashEdits}, expected 1 — the python heredoc write`);
  ok(s.rereads[0]?.file === "Services/TrailService.cs" && s.rereads[0]?.count === 3,
     `rereads ${JSON.stringify(s.rereads)} — a file read 3x via Read and sed must show`);
  ok(s.shown.join() === "srid-4326.md,spatialite-per-os.md", `shown ${s.shown} — only hook recalls count`);
  ok(s.opened.join() === "srid-4326.md", `opened ${s.opened}`);
  ok(s.refused === 1, `refused ${s.refused}, expected 1 — exit codes are not refusals`);
  ok(s.date === "2026-10-01", `date ${s.date}`);
  n += 10;

  // -- what counts as an edit through Bash --------------------------------------
  ok(isBashEdit("sed -i 's/a/b/' backend/X.cs"), "sed -i was not an edit");
  ok(!isBashEdit("sed -n '1,40p' backend/X.cs | grep -i foo"), "sed -n | grep -i read as sed -i");
  ok(isBashEdit("cat > docs/notes/x.md <<'EOF'\nbody with -> and > arrows\nEOF"), "a heredoc into a repo file was not an edit");
  ok(!isBashEdit("dotnet test 2>&1 | tail -5"), "2>&1 read as a redirect");
  ok(!isBashEdit("node -e 'const f = (a) => a > 1' > /dev/null"), "a quoted > or /dev/null read as an edit");
  ok(!isBashEdit("git log --oneline > /tmp/claude-1000/x/scratchpad/log.txt"), "a scratchpad redirect read as an edit");
  ok(!isBashEdit("cat > /tmp/x/scratchpad/m.py <<'EOF'\nimport os\npython3 -c 1\nopen(F,'w').write(s)\nEOF"),
     "writing a script to the scratchpad read as running it");
  n += 7;

  // -- the gate ------------------------------------------------------------------
  const base = { asked: false };
  ok(!shouldAsk(base, { calls: RETRO_MIN_CALLS - 1 }, ["a"]), "a short session without a plan was asked");
  ok(shouldAsk(base, { calls: RETRO_MIN_CALLS }, ["a"]), "a non-trivial session was not asked");
  ok(shouldAsk({ ...base, plan: true }, { calls: 1 }, ["a"]), "a plan session was not asked");
  ok(!shouldAsk({ ...base, plan: true }, { calls: 99 }, []), "a clean tree spent the round (defect 2)");
  ok(!shouldAsk({ asked: true, plan: true }, { calls: 99 }, ["a"]), "the round spoke twice");
  n += 5;

  // -- prompt recall never repeats a note ---------------------------------------
  const scoredWt = scoreEntries(entries, "worktree repo root discovery");
  ok(freshMatches(scoredWt, []).length > 0, "a matching prompt recalled nothing");
  ok(freshMatches(scoredWt, ["git-worktree-repo-root.md"]).length === 0, "a note already shown was shown again");
  ok(renderPrompt([]) === "", "an empty recall still spoke");
  ok(SHOWN_MARKER.test(renderPrompt(scoredWt)), "prompt recall text no longer carries the marker sessionStats reads");
  n += 4;

  // -- the ledger summary ----------------------------------------------------------
  const rec = (date, opened, shown = []) => ({ date, calls: 20, preEdit: 10, opened, shown });
  const sum = summarize([
    rec("2026-09-14", ["a.md", "b.md"], ["c.md", "a.md"]),
    rec("2026-09-15", ["a.md"], ["c.md", "a.md"]),
    rec("2026-09-22", ["a.md", "b.md"], ["c.md", "a.md"]),
  ]);
  ok(sum.promote.map((p) => p.note).join() === "a.md", `promote ${JSON.stringify(sum.promote)}`);
  ok(sum.noisy.map((p) => p.note).join() === "c.md", `noisy ${JSON.stringify(sum.noisy)}`);
  ok(sum.trend.length === 2 && sum.trend[0].week === "2026-09-14" && sum.trend[0].n === 2,
     `trend ${JSON.stringify(sum.trend.map((t) => [t.week, t.n]))}`);
  ok(/Promotion candidates/.test(renderReport(sum, "x")), "the report dropped the promotion list");
  n += 4;

  // -- gating: round 2 must not speak without a baseline, and must not loop --------
  ok(phaseAfter({ session_id: "no-such-session-for-self-test" }) === 0,
     "round 2 spoke for a session that has no baseline");
  ok(phaseAfter({ session_id: "x", stop_hook_active: true }) === 0, "round 2 ignored stop_hook_active");
  n += 2;

  // -- INDEX.md <-> files, against the real docs/notes ---------------------------
  ok(typeof checkNotes === "function", "check-notes is not wired");
  n++;
  return done(n);
}

process.exit(main());
