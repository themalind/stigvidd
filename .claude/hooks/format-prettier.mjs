#!/usr/bin/env node
// Keeps app/, web/ and site/ prettier-formatted, whichever way a file was changed.
//
//   PostToolUse(Write|Edit|MultiEdit)  formats the file just edited.
//   Stop                               formats every changed or untracked file in those
//                                      workspaces, which is what catches an edit made
//                                      through Bash (sed, a heredoc, a script) — no Edit
//                                      event ever fires for those.
//
// Each workspace's own prettier and .prettierrc/.prettierignore decide, so the hook and
// `npm run format:check` (which CI runs) can never disagree. A prettier with no workspace
// config reads the root .editorconfig and reindents to 4 spaces; see
// docs/notes/prettier-outside-a-workspace-reads-editorconfig.md. web/src/api/generated is
// in web/.prettierignore: `generate:api` must reproduce it byte for byte.
//
// Speaks (exit 2) only when it actually rewrote something, because the file on disk then
// differs from what the editor last read and the next Edit must Read it first. Silent
// when a workspace has no node_modules. Never blocks; Stop respects stop_hook_active.
//
// Self-test: `node .claude/hooks/format-prettier.mjs --self-test`
//   covers routing and git-status parsing. Add `--with-prettier` to format a planted
//   file in each installed workspace, and to prove an ignored path is left alone.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { readEvent, repoRoot, relKey, git, run, speak, checker } from "./lib.mjs";

const WORKSPACES = ["app", "web", "site"];
const MAX_SHOWN = 10;

/** The workspace owning a repo-relative POSIX path, with its prettier entry point. */
export function workspaceFor(root, rel) {
  if (!rel || /(?:^|\/)node_modules\//.test(rel)) return null;
  const ws = WORKSPACES.find((w) => rel.startsWith(w + "/"));
  if (!ws) return null;
  // The .bin entry is a .cmd shim on Windows; run the script itself with node.
  const bin = path.join(root, ws, "node_modules", "prettier", "bin", "prettier.cjs");
  return existsSync(bin) ? { ws, dir: path.join(root, ws), bin } : null;
}

/** Paths from `git status --porcelain -z`: changed, staged or untracked, not deleted. */
export function changedPaths(porcelainZ) {
  const fields = String(porcelainZ ?? "").split("\0");
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.length < 4) continue;
    const xy = f.slice(0, 2);
    // A rename or copy is followed by its source path as the next field.
    if (/[RC]/.test(xy)) i++;
    if (xy.includes("D")) continue;
    out.push(f.slice(3));
  }
  return out;
}

const read = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
};

/** Format repo-relative files in one workspace; returns the ones prettier rewrote. */
function format(root, w, rels) {
  const files = rels.filter((r) => existsSync(path.join(root, r)));
  if (!files.length) return [];
  const before = new Map(files.map((r) => [r, read(path.join(root, r))]));
  // --ignore-unknown: a .png or .lock is not a finding. The workspace's .prettierignore
  // applies to explicitly named files too, so ignored paths come back untouched.
  run(
    process.execPath,
    [w.bin, "--write", "--ignore-unknown", "--log-level", "silent", ...files.map((r) => r.slice(w.ws.length + 1))],
    {
      cwd: w.dir,
      timeout: 30_000,
    },
  );
  return files.filter((r) => read(path.join(root, r)) !== before.get(r));
}

function report(changed, why) {
  const shown = changed
    .slice(0, MAX_SHOWN)
    .map((r) => `  ${r}`)
    .join("\n");
  const more = changed.length > MAX_SHOWN ? `\n  (+${changed.length - MAX_SHOWN} more)` : "";
  return speak(
    `prettier reformatted ${changed.length} file(s) ${why}:\n${shown}${more}\n` +
      "That is the project's style; keep it. Read a file again before the next Edit to it.",
  );
}

function onEdit(ev, root) {
  const raw = ev.tool_input?.file_path;
  if (!raw) return 0;
  const rel = relKey(root, raw);
  const w = workspaceFor(root, rel);
  if (!w) return 0;
  const changed = format(root, w, [rel]);
  return changed.length ? report(changed, "after this edit") : 0;
}

function onStop(ev, root) {
  if (ev.stop_hook_active) return 0;
  const status = git(root, "status", "--porcelain", "-z", "--untracked-files=all", "--", ...WORKSPACES);
  if (status === null) return 0;
  const byWs = new Map();
  for (const p of changedPaths(status)) {
    const rel = relKey(root, p);
    const w = workspaceFor(root, rel);
    if (!w) continue;
    if (!byWs.has(w.ws)) byWs.set(w.ws, { w, rels: [] });
    byWs.get(w.ws).rels.push(rel);
  }
  const changed = [];
  for (const { w, rels } of byWs.values()) changed.push(...format(root, w, rels));
  return changed.length ? report(changed, "changed outside Edit/Write (Bash edits)") : 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest(argv.includes("--with-prettier"));
  try {
    const ev = readEvent();
    const root = repoRoot(ev);
    if (!root) return 0;
    return ev.hook_event_name === "Stop" ? onStop(ev, root) : onEdit(ev, root);
  } catch {
    return 0;
  }
}

function selfTest(withPrettier) {
  const { ok, done } = checker("format-prettier");
  let n = 0;

  const st = [
    " M app/src/a.ts",
    "?? web/src/new.tsx",
    "D  site/src/gone.ts",
    "R  web/src/b.ts",
    "web/src/old.ts",
    "A  site/src/c.ts",
    "",
  ].join("\0");
  const paths = changedPaths(st);
  ok(paths.join(",") === "app/src/a.ts,web/src/new.tsx,web/src/b.ts,site/src/c.ts", `status parse: ${paths.join(",")}`);
  ok(changedPaths("").length === 0, "an empty status parsed to paths");
  ok(changedPaths(null).length === 0, "a failed git call parsed to paths");
  n += 3;

  const root = repoRoot({});
  if (root) {
    // Negative cases: silence outside the three workspaces.
    for (const rel of [
      "backend/Core/X.cs",
      "README.md",
      ".claude/hooks/lib.mjs",
      "app/node_modules/x/index.js",
      "apps/src/x.ts",
      null,
    ]) {
      ok(workspaceFor(root, rel) === null, `${rel} resolved to a workspace`);
      n++;
    }
    // Windows-shaped input reaches the same workspace once relKey has folded it.
    for (const ws of WORKSPACES) {
      const w = workspaceFor(root, relKey(root, `${ws}\\src\\x.ts`));
      const installed = existsSync(path.join(root, ws, "node_modules", "prettier"));
      ok(installed ? w?.ws === ws : w === null, `${ws}: backslash path resolved to ${w?.ws}`);
      n++;
    }

    if (withPrettier) {
      for (const ws of WORKSPACES) {
        const w = workspaceFor(root, `${ws}/src/x.ts`);
        if (!w) continue;
        const rel = `${ws}/src/zz-format-hook-self-test.ts`;
        const abs = path.join(root, rel);
        try {
          writeFileSync(abs, "export const  x = {a:1,\n b:2}\n");
          ok(format(root, w, [rel]).length === 1, `${ws}: prettier did not rewrite a planted file`);
          ok(
            read(abs) === "export const x = { a: 1, b: 2 };\n",
            `${ws}: unexpected output ${JSON.stringify(read(abs))}`,
          );
          ok(format(root, w, [rel]).length === 0, `${ws}: an already formatted file was reported`);
          n += 3;
        } finally {
          rmSync(abs, { force: true });
        }
      }
      const w = workspaceFor(root, "web/src/x.ts");
      if (w) {
        const dir = path.join(root, "web", "src", "api", "generated");
        const abs = path.join(dir, "zz-format-hook-self-test.ts");
        const ugly = "export const  x = {a:1}\n";
        try {
          mkdirSync(dir, { recursive: true });
          writeFileSync(abs, ugly);
          format(root, w, ["web/src/api/generated/zz-format-hook-self-test.ts"]);
          ok(read(abs) === ugly, "the generated client was reformatted despite web/.prettierignore");
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
