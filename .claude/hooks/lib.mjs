// Shared helpers for this repo's Claude Code hooks.
//
// WHY NODE AND NOT PYTHON.  `python3` is the command name on Linux and is usually
// absent on Windows (`python` / `py -3` there), and Python is not a prerequisite of
// this repo at all.  `node` is one name on Windows, Gentoo and Debian, and Node 24 is
// already required by web/ and app/.  See docs/notes/agent-harness-hooks.md.
//
// THE THREE RULES THAT KEEP A HOOK CROSS-PLATFORM, all of which fail *open* — that is,
// silently guarding nothing — when broken:
//
//   1. Paths arrive in the shape the host OS uses.  The Edit tool on Windows sends
//      `web\src\api\generated\x.ts`; a guard matching only `web/src/api/generated/`
//      lets it straight through.  relKey() normalises separators BEFORE resolving, and
//      lowercases on win32 where the filesystem is case-insensitive.
//   2. Commands arrive in the shape the shell uses.  The Bash tool runs Git Bash on
//      Windows, so bash forms are primary — but `$env:X="1"; npx expo start` and
//      `set X=1 && dotnet test` both reach a hook that only understands `X=1 cmd` as
//      one opaque string with no recognisable command at its head.  commandsIn()
//      handles all three vocabularies.
//   3. Never spawn through a shell, and never spawn a .cmd/.bat shim.  On Windows the
//      npm/npx/eslint entries in node_modules/.bin are shims, not executables; run()
//      is deliberately `shell: false`, so callers must name a real binary (`node`,
//      `dotnet`, `git`) and pass the script as an argument.
//
// Everything here fails silent by design: a hook must never be able to wedge a session.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

export const WIN = process.platform === "win32";

/** Read the hook event from stdin. Any malformed input is an empty event, not a crash. */
export function readEvent() {
  try {
    const ev = JSON.parse(readFileSync(0, "utf8"));
    return ev && typeof ev === "object" && !Array.isArray(ev) ? ev : {};
  } catch {
    return {};
  }
}

/**
 * The repo root, walking up for `.git`.
 *
 * `existsSync`, not a directory test: in a LINKED WORKTREE `.git` is a FILE. That
 * distinction is the same one that broke OpenApiContractTests
 * (docs/notes/git-worktree-repo-root.md), and every session here runs in a worktree.
 */
export function repoRoot(ev = {}) {
  for (const start of [process.env.CLAUDE_PROJECT_DIR, ev.cwd, process.cwd()]) {
    if (!start) continue;
    let p;
    try {
      p = path.resolve(String(start));
    } catch {
      continue;
    }
    for (;;) {
      if (existsSync(path.join(p, ".git"))) return p;
      const up = path.dirname(p);
      if (up === p) break;
      p = up;
    }
  }
  return null;
}

/** Case-fold for comparison, on the platforms where the filesystem does. */
export const fold = (s) => (WIN ? String(s).toLowerCase() : String(s));

/**
 * A tool's file_path as a repo-relative POSIX key, or null if it is outside the repo.
 *
 * Backslashes are folded to `/` BEFORE resolving, which is what makes the Windows form
 * match on any host — and lets the self-tests exercise the Windows shape from Linux CI.
 * (A literal backslash in a POSIX filename would be mangled; that is the right trade,
 * and no path in this repo has one.)
 */
export function relKey(root, filePath) {
  if (!root || !filePath) return null;
  let rel;
  try {
    const abs = path.resolve(root, String(filePath).replace(/\\/g, "/"));
    rel = path.relative(root, abs).replace(/\\/g, "/");
  } catch {
    return null;
  }
  if (!rel || rel === ".." || rel.startsWith("../")) return null;
  return fold(rel);
}

/** True when `key` is inside `dir` (both repo-relative, `dir` written POSIX). */
export const under = (key, dir) => {
  const d = fold(dir.replace(/\/*$/, "/"));
  return key === fold(dir.replace(/\/*$/, "")) || key.startsWith(d);
};

/** Spawn without a shell. Returns null if the binary is missing or the call threw. */
export function run(cmd, args, opts = {}) {
  try {
    const r = spawnSync(cmd, args, {
      cwd: opts.cwd,
      encoding: "utf8",
      timeout: opts.timeout ?? 10_000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      shell: false, // rule 3 above — never a .cmd shim, never a shell
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
    });
    if (r.error) return null;
    return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch {
    return null;
  }
}

/** git, with the index lock left alone — a hook must not block a concurrent command. */
export function git(root, ...args) {
  const r = run("git", ["--no-optional-locks", ...args], { cwd: root });
  return r && r.code === 0 ? r.stdout : null;
}

/** Per-user scratch dir for hook state. os.tmpdir(), so it resolves on all three. */
export function stateDir() {
  const uid = typeof process.getuid === "function" ? process.getuid() : "win";
  return path.join(tmpdir(), `stigvidd-hooks-${uid}`);
}

export function mtime(p) {
  try {
    return statSync(p).mtimeMs;
  } catch {
    return null;
  }
}

/** Newline-agnostic line split: this repo has CRLF files and no .gitattributes yet. */
export const lines = (s) => String(s).replace(/\r\n?/g, "\n").split("\n");

// ---------------------------------------------------------------------------
// Command parsing
// ---------------------------------------------------------------------------

// Prefixes that stand BETWEEN a command position and the command actually run. Missing
// one fails open, which is exactly how scire's test-runner guard was bypassed for weeks
// by a bare leading `VAR=val` — and an env knob is the main reason to type one.
const PREFIX_PATTERNS = [
  /^[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+/, //  X=1 cmd            (bash)
  /^\$env:[A-Za-z_][A-Za-z0-9_]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s;]*)\s*;?\s*/, // (pwsh)
  /^set\s+[A-Za-z_][A-Za-z0-9_]*=\S*\s+/i, //               set X=1 cmd        (cmd)
  /^export\s+[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+/,
  /^env\s+(?:-i\s+|-u\s+\S+\s+|[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+)*/,
  /^timeout\s+(?:-k\s+\S+\s+)?(?:--\S+\s+)*\S+\s+/,
  /^(?:nice|ionice)\s+(?:-[a-zA-Z]\s*\S*\s+)*/,
  /^stdbuf\s+(?:-[ioe]\S*\s+)+/,
  /^(?:sudo|command|exec|nohup)\s+/,
  /^(?:npx|bunx|pnpm\s+dlx|yarn\s+dlx|npm\s+exec)\s+(?:--\s+|-y\s+|--yes\s+)*/,
];

/**
 * Every execution position in a command string, prefix runs stripped.
 *
 * Quote-aware, and it also steps INTO `$( )`, backticks and `( )` — a command inside a
 * substitution is still a command. It errs toward reporting more positions than a shell
 * would: a spurious position can only make a guard look harder, a missed one makes it
 * fail open.
 */
export function commandsIn(command) {
  const s = String(command ?? "");
  const starts = [0];
  let q = null; // "'" or '"'
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
      else if (c === "\\" && q === '"') i++;
      continue;
    }
    if (c === "'" || c === '"') {
      q = c;
      continue;
    }
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "$" && s[i + 1] === "(") {
      starts.push(i + 2);
      i++;
      continue;
    }
    if (c === "`" || c === "(" || c === "{" || c === "\n") {
      starts.push(i + 1);
      continue;
    }
    if (c === ";") {
      starts.push(i + 1);
      continue;
    }
    if (c === "|" || c === "&") {
      starts.push(s[i + 1] === c ? i + 2 : i + 1);
      if (s[i + 1] === c) i++;
      continue;
    }
  }
  const out = [];
  for (const at of starts) {
    let seg = s.slice(at).replace(/^\s+/, "");
    for (let again = true; again; ) {
      again = false;
      for (const re of PREFIX_PATTERNS) {
        const m = seg.match(re);
        if (m && m[0].length) {
          seg = seg.slice(m[0].length).replace(/^\s+/, "");
          again = true;
          break;
        }
      }
    }
    if (seg) out.push(seg);
  }
  return out;
}

/** Every env var name the command string assigns, in any of the three shells' syntax. */
export function envNamesSet(command) {
  const s = String(command ?? "");
  const names = new Set();
  const res = [
    /(?:^|[\s;&|(])([A-Za-z_][A-Za-z0-9_]*)=/g,
    /\$env:([A-Za-z_][A-Za-z0-9_]*)\s*=/gi,
    /(?:^|[\s;&|])(?:set|export)\s+([A-Za-z_][A-Za-z0-9_]*)=/gi,
  ];
  for (const re of res) for (const m of s.matchAll(re)) names.add(m[1]);
  return names;
}

/** Does this command string invoke `name` (optionally with `sub` as its first word)? */
export function invokes(command, name, sub = null) {
  const nameRe = new RegExp(`^${name}(?:\\.(?:exe|cmd|bat|ps1))?(?=\\s|$)`, "i");
  for (const seg of commandsIn(command)) {
    // A path-qualified form (./node_modules/.bin/eslint, C:\tools\dotnet.exe) counts too.
    const head = seg.split(/\s+/, 1)[0];
    const base = head.replace(/\\/g, "/").split("/").pop() ?? head;
    if (!nameRe.test(base)) continue;
    if (sub === null) return seg;
    const rest = seg.slice(head.length).replace(/^\s+/, "");
    if (new RegExp(`^${sub}(?=\\s|$)`, "i").test(rest)) return seg;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook output
// ---------------------------------------------------------------------------

/** PreToolUse: block the call, with the command that does work. */
export function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }) + "\n",
  );
  return 0;
}

/** Put text in front of Claude in the same turn without blocking anything. */
export function speak(text) {
  process.stderr.write(text.endsWith("\n") ? text : text + "\n");
  return 2;
}

/** SessionStart: inject orientation into the session's context. */
export function inject(text) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text },
    }) + "\n",
  );
  return 0;
}

/** Tiny assertion harness shared by every hook's --self-test. */
export function checker(label) {
  let bad = 0;
  const ok = (cond, why) => {
    if (!cond) {
      process.stderr.write(`SELF-TEST FAIL: ${why}\n`);
      bad++;
    }
  };
  const done = (n) => {
    process.stdout.write(`${label} self-test: ${n} case(s), ${bad} failure(s)\n`);
    return bad ? 1 : 0;
  };
  return { ok, done };
}
