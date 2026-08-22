#!/usr/bin/env node
/**
 * The gate for the agent harness: `node scripts/check-hooks.mjs`
 *
 * A hook is the only code in this repo that runs against no test, produces no artifact,
 * and fails closed to exit 0 by design — a broken one must never wedge a session. Every
 * one of its failure modes is therefore SILENT, and "it looks like it is working" is
 * worth nothing. This is what makes that loud:
 *
 *   1. Every hook's own --self-test passes. Each asserts its routing predicates and its
 *      deny decisions, including the Windows-shaped inputs (backslash paths, `$env:` and
 *      `set` command prefixes) that are the ones which fail OPEN when mishandled — so
 *      Linux CI covers the Windows behaviour too.
 *   2. Every hook named in .claude/settings.json exists, and every hook that exists is
 *      named in .claude/settings.json. A renamed file leaves a registration pointing at
 *      nothing; a new file that was never registered guards nothing. Neither says a word
 *      at runtime.
 *   3. Every registration uses EXEC form (`command` + `args`). Shell form needs `$VAR` on
 *      bash and `$env:`/`%VAR%` on Windows — where Claude Code falls back to PowerShell
 *      when Git Bash is absent — so a shell-form entry cannot be correct on all three
 *      platforms at once. Exec form has no shell and no quoting.
 *   4. docs/notes/INDEX.md and docs/notes/*.md name each other, so no note is
 *      unreachable and no index line dangles.
 *
 * Runs in ~2 s, needs only node and git, and is wired into .github/workflows/ci.yml (on
 * both ubuntu and windows) and the Jenkinsfile Preflight stage.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOKS = path.join(ROOT, ".claude", "hooks");
const SETTINGS = path.join(ROOT, ".claude", "settings.json");

let failures = 0;
const fail = (msg) => {
  process.stderr.write(`GATE FAIL: ${msg}\n`);
  failures++;
};
const note = (msg) => process.stdout.write(msg + "\n");

// --- 1. every hook's self-test -----------------------------------------------------
const hookFiles = existsSync(HOOKS)
  ? readdirSync(HOOKS)
      .filter((f) => f.endsWith(".mjs") && f !== "lib.mjs")
      .sort()
  : [];
if (!hookFiles.length) fail(".claude/hooks/ has no hooks — the harness is not installed");

for (const f of hookFiles) {
  const r = spawnSync(process.execPath, [path.join(HOOKS, f), "--self-test"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 180_000,
    windowsHide: true,
    shell: false,
  });
  const out = ((r.stdout ?? "") + (r.stderr ?? "")).trim();
  if (r.error) fail(`${f}: could not run (${r.error.message})`);
  else if (r.status !== 0) fail(`${f}: self-test failed\n${out.replace(/^/gm, "    ")}`);
  else if (!/self-test:/.test(out)) fail(`${f}: --self-test produced no verdict — is it wired up?`);
  else note(`  ok  ${out.split("\n").pop()}`);
}

// --- 2 & 3. the registrations -------------------------------------------------------
let settings = null;
try {
  settings = JSON.parse(readFileSync(SETTINGS, "utf8"));
} catch (e) {
  fail(`.claude/settings.json is missing or unparseable (${e.message})`);
}

if (settings) {
  const registered = new Set();
  for (const [event, matchers] of Object.entries(settings.hooks ?? {}))
    for (const m of matchers ?? [])
      for (const h of m.hooks ?? []) {
        const argv = h.args ?? [];
        if (!Array.isArray(h.args) || !h.args.length)
          fail(
            `${event}: a hook is registered in SHELL form (\`${h.command}\`). Use exec ` +
              `form — "command": "node", "args": ["\${CLAUDE_PROJECT_DIR}/..."] — or it ` +
              "cannot be written once and be right on bash and PowerShell both.",
          );
        for (const a of argv) {
          const m2 = String(a).match(/\.claude\/hooks\/([A-Za-z0-9_.-]+\.mjs)/);
          if (!m2) continue;
          registered.add(m2[1]);
          if (!existsSync(path.join(HOOKS, m2[1])))
            fail(`${event}: registered ${m2[1]}, which does not exist — that hook guards nothing`);
        }
      }
  for (const f of hookFiles)
    if (!registered.has(f))
      fail(`${f} exists but is registered in no event — it will never run`);
  note(`  ok  ${registered.size} registration(s), all exec form, all resolving to a file`);
}

// --- 4. the notes index -------------------------------------------------------------
const planEval = path.join(HOOKS, "plan-eval.mjs");
if (existsSync(planEval)) {
  const r = spawnSync(process.execPath, [planEval, "--check-notes"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
    shell: false,
  });
  const out = ((r.stdout ?? "") + (r.stderr ?? "")).trim();
  if (r.status !== 0) fail(`docs/notes is inconsistent\n${out.replace(/^/gm, "    ")}`);
  else note(`  ok  ${out.split("\n").pop()}`);
}

note(failures ? `\ncheck-hooks: ${failures} failure(s)` : "\ncheck-hooks: all green");
process.exit(failures ? 1 : 0);
