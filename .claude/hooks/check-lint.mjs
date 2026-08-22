#!/usr/bin/env node
// PostToolUse(Write|Edit): lint the TS/JS file you just edited, in its own workspace.
//
// Reports ONLY what this edit introduced. The HEAD version of the same file is linted
// through `--stdin --stdin-filename <the real path>`, so eslint resolves exactly the same
// flat config for the baseline as for the current content — a temp file somewhere else
// would silently pick up different rules and the difference would be noise. The two
// result sets are then differenced by rule + message, not by line, because an edit above
// a pre-existing problem shifts its line number without changing it.
//
// WHAT THIS DOES NOT SEE, which matters because it is easy to read a quiet hook as a
// clean bill of health: eslint is per-file, so nothing here catches a type error that
// spans files — a changed export, a renamed prop, a signature its callers no longer fit.
//   * web/  `npm run build` (tsc -b && vite build) is the type check, and CI runs it.
//   * app/  nothing in CI type-checks at all — .github/workflows/ci.yml runs
//     format:check, lint and jest, so `cd app && npx tsc --noEmit` is a step you have to
//     take deliberately.
//
// Silent when the workspace has no node_modules (a fresh worktree, or CI before npm ci):
// a missing linter is not a finding. Never blocks.
//
// Self-test: `node .claude/hooks/check-lint.mjs --self-test`
//   drives the result parser and the differencing over verbatim eslint JSON. Add
//   `--with-eslint` to lint a planted defect for real, where node_modules exists.
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { readEvent, repoRoot, relKey, git, speak, checker } from "./lib.mjs";

const MAX_SHOWN = 8;
const WORKSPACES = ["web", "app"];

/** Which workspace owns this repo-relative path, and where its eslint lives. */
export function workspaceFor(root, rel) {
  const ws = WORKSPACES.find((w) => rel.startsWith(w + "/"));
  if (!ws) return null;
  // node_modules/.bin/eslint is a .cmd shim on Windows and cannot be spawned without a
  // shell, so the script itself is what we run, with `node`.
  // See docs/notes/agent-harness-hooks.md.
  const bin = path.join(root, ws, "node_modules", "eslint", "bin", "eslint.js");
  return existsSync(bin) ? { ws, dir: path.join(root, ws), bin } : null;
}

/** Findings from `eslint --format json`, as {rule, sev, line, text}. */
export function parseEslint(stdout) {
  let docs;
  try {
    docs = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!Array.isArray(docs)) return null;
  const out = [];
  for (const d of docs)
    for (const m of d.messages ?? [])
      out.push({
        rule: m.ruleId ?? (m.fatal ? "parse-error" : "unknown"),
        sev: m.severity ?? 2,
        line: m.line ?? 0,
        text: String(m.message ?? ""),
      });
  return out;
}

/** Findings present now and not at HEAD, matched on rule + message so lines may shift. */
export function introduced(now, base) {
  const key = (f) => `${f.rule} ${f.text}`;
  const budget = new Map();
  for (const f of base ?? []) budget.set(key(f), (budget.get(key(f)) ?? 0) + 1);
  const fresh = [];
  for (const f of now) {
    const k = key(f);
    const left = budget.get(k) ?? 0;
    if (left > 0) budget.set(k, left - 1); // an occurrence that already existed
    else fresh.push(f);
  }
  return fresh;
}

export function render(rel, ws, fresh) {
  const errs = fresh.filter((f) => f.sev === 2);
  const shown = (errs.length ? errs : fresh).slice(0, MAX_SHOWN);
  const body = shown.map((f) => `  ${rel}:${f.line}  ${f.rule}: ${f.text}`).join("\n");
  const total = errs.length ? errs.length : fresh.length;
  const more = total > MAX_SHOWN ? `\n  (+${total - MAX_SHOWN} more)` : "";
  const typeCheck =
    ws === "web"
      ? "`cd web && npm run build` is the type check (tsc -b && vite build)"
      : "nothing in CI type-checks app/ — run `cd app && npx tsc --noEmit` yourself";
  return (
    `${rel}: ${total} new eslint ${errs.length ? "error" : "problem"}(s) this edit ` +
    `introduced (differenced against the same file at HEAD):\n${body}${more}\n` +
    `eslint is per-file and sees no cross-file type error — ${typeCheck}.`
  );
}

function lint(w, relInWs, stdinText) {
  const args = ["--format", "json"];
  if (stdinText === null) args.push(relInWs);
  else args.push("--stdin", "--stdin-filename", relInWs);
  try {
    const r = spawnSync(process.execPath, [w.bin, ...args], {
      cwd: w.dir,
      input: stdinText ?? undefined,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      shell: false,
    });
    if (r.error) return null;
    return parseEslint(r.stdout ?? "");
  } catch {
    return null;
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest(argv.includes("--with-eslint"));
  const ev = readEvent();
  const raw = ev.tool_input?.file_path;
  if (!raw || !/\.[cm]?[jt]sx?$/i.test(String(raw))) return 0;
  const root = repoRoot(ev);
  if (!root) return 0;
  const rel = relKey(root, raw);
  if (!rel || /(?:^|\/)node_modules\//.test(rel)) return 0;
  // Generated output has its own guard and is not ours to lint.
  if (rel.startsWith("web/src/api/generated/")) return 0;
  const w = workspaceFor(root, rel);
  if (!w || !existsSync(path.join(root, rel))) return 0;

  const relInWs = rel.slice(w.ws.length + 1);
  const now = lint(w, relInWs, null);
  if (!now || !now.length) return 0;

  // The baseline: HEAD's content of the same file, fed through stdin under the same
  // filename so the flat config resolves identically. A file new in this commit has no
  // HEAD version, and then everything in it is new.
  const head = git(root, "show", `HEAD:${rel}`);
  const base = head === null ? [] : (lint(w, relInWs, head) ?? []);
  const fresh = introduced(now, base);
  if (!fresh.length) return 0;
  return speak(render(rel, w.ws, fresh));
}

// Verbatim `eslint --format json` shape.
const NOW_JSON = JSON.stringify([
  {
    filePath: "/w/app/src/x.ts",
    messages: [
      {
        ruleId: "@typescript-eslint/no-unused-vars",
        severity: 2,
        line: 12,
        message: "'q' is defined but never used.",
      },
      { ruleId: "no-console", severity: 1, line: 40, message: "Unexpected console statement." },
      { ruleId: "eqeqeq", severity: 2, line: 51, message: "Expected '===' and instead saw '=='." },
    ],
  },
]);
const BASE_JSON = JSON.stringify([
  {
    filePath: "/w/app/src/x.ts",
    messages: [
      { ruleId: "no-console", severity: 1, line: 7, message: "Unexpected console statement." },
      { ruleId: "eqeqeq", severity: 2, line: 9, message: "Expected '===' and instead saw '=='." },
    ],
  },
]);

function selfTest(withEslint) {
  const { ok, done } = checker("check-lint");
  let n = 0;

  const now = parseEslint(NOW_JSON);
  const base = parseEslint(BASE_JSON);
  ok(now?.length === 3, `parse: ${now?.length} findings, expected 3`);
  ok(parseEslint("not json") === null, "malformed eslint output did not parse to null");
  ok(parseEslint("[]")?.length === 0, "an empty run did not parse to zero findings");
  n += 3;

  const fresh = introduced(now, base);
  ok(
    fresh.length === 1 && fresh[0].rule === "@typescript-eslint/no-unused-vars",
    `differencing kept ${fresh.map((f) => f.rule).join(",")}, expected only the new one`,
  );
  // The line number of a pre-existing finding shifts when you edit above it; that must
  // not read as new.
  ok(
    introduced(now, parseEslint(NOW_JSON.replace(/"line":\s*\d+/g, '"line":999'))).length === 0,
    "a pre-existing finding on a shifted line was reported as introduced",
  );
  // Two occurrences now against one at HEAD is one new occurrence, not zero.
  ok(introduced([...now, now[2]], base).length === 2, "a second occurrence of an existing finding was swallowed");
  ok(introduced(now, []).length === 3, "with no baseline, everything is new");
  n += 4;

  const msg = render("app/src/x.ts", "app", fresh);
  ok(/no-unused-vars/.test(msg), "the message dropped the finding");
  ok(/tsc --noEmit/.test(msg), "the app message does not say nothing type-checks app/");
  ok(/npm run build/.test(render("web/src/x.ts", "web", fresh)), "the web message does not name the type check");
  n += 3;

  const root = repoRoot({});
  if (root) {
    ok(workspaceFor(root, "backend/Core/X.cs") === null, "a backend path resolved to a JS workspace");
    n++;
    for (const ws of WORKSPACES) {
      const w = workspaceFor(root, `${ws}/src/x.ts`);
      // Absent node_modules must be silence, not a failure — that is a fresh worktree.
      ok(w === null || /eslint\.js$/.test(w.bin), `${ws}: resolved eslint to ${w?.bin}`);
      n++;
    }
    if (withEslint) {
      const w = workspaceFor(root, "app/src/zz-hook-self-test.ts");
      if (w) {
        const abs = path.join(w.dir, "src", "zz-hook-self-test.ts");
        try {
          writeFileSync(abs, "const unusedOnPurpose = 1;\nexport default function f() { return 2 == 2; }\n");
          const got = lint(w, "src/zz-hook-self-test.ts", null) ?? [];
          ok(got.length > 0, "eslint reported nothing on a planted defect — the check does not bite");
          n++;
        } finally {
          rmSync(abs, { force: true });
        }
      }
    }
  }
  return done(n);
}

process.exit(main());
