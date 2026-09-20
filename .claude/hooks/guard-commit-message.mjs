#!/usr/bin/env node
// PreToolUse(Bash): denies a `git commit` whose message mentions Claude/Anthropic
// authorship, or that runs over a short length budget.
//
// Self-test: `node .claude/hooks/guard-commit-message.mjs --self-test`
import process from "node:process";
import { readEvent, deny, checker, invokes } from "./lib.mjs";

const MAX_LEN = 72;
const FORBIDDEN = [/claude/i, /anthropic/i, /co-authored-by/i, /generated with/i, /🤖/];

export function extractMessage(raw) {
  const s = String(raw ?? "");

  const heredoc = s.match(/<<[-~]?\s*['"]?(\w+)['"]?\r?\n([\s\S]*?)\r?\n\1\b/);
  if (heredoc) return heredoc[2];

  const parts = [];
  const re = /-m\s+(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
  let m;
  while ((m = re.exec(s))) parts.push(m[1] ?? m[2] ?? "");
  return parts.length ? parts.join("\n\n") : null;
}

export function classify(message) {
  if (message == null) return null;
  const trimmed = message.trim();
  if (!trimmed) return null;

  const hit = FORBIDDEN.find((re) => re.test(trimmed));
  if (hit)
    return [
      "deny",
      `Commit message matches ${hit} — no Claude/Anthropic authorship mention is allowed in a commit message here. Rewrite it without that and retry.`,
    ];

  if (trimmed.length > MAX_LEN)
    return [
      "deny",
      `Commit message is ${trimmed.length} characters; keep it to ${MAX_LEN} or fewer, one line. Rewrite it shorter and retry.`,
    ];

  return null;
}

export function decide(toolName, input) {
  if (toolName !== "Bash") return null;
  const command = String(input?.command ?? "");
  if (!invokes(command, "git", "commit")) return null;
  return classify(extractMessage(command));
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const ev = readEvent();
  const d = decide(String(ev.tool_name ?? ""), ev.tool_input ?? {});
  return d ? deny(d[1]) : 0;
}

function selfTest() {
  const { ok, done } = checker("guard-commit-message");

  const heredocClaude =
    'git commit -m "$(cat <<\'EOF\'\nAdd batch reprocessing\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>\nEOF\n)"';
  const heredocClean =
    'git commit -m "$(cat <<\'EOF\'\nAdd media batch reprocessing\nEOF\n)"';
  const heredocEmoji =
    'git commit -m "$(cat <<\'EOF\'\nAdd feature\n\n🤖 Generated with Claude Code\nEOF\n)"';

  const cases = [
    [heredocClaude, "deny"],
    [heredocEmoji, "deny"],
    ['git commit -m "This commit message is deliberately far too long to fit the short budget we enforce"', "deny"],
    [heredocClean, null],
    ['git commit -m "Add media batch reprocessing"', null],
    ["git commit", null],
    ["git status", null],
    ["git log --oneline -5", null],
    ['git add -A && git commit -m "Fix bug"', null],
    ['$env:X="1"; git commit -m "Fix bug"', null],
    ['echo claude && git commit -m "Add feature"', null],
    ['npm test', null],
  ];

  for (const [command, want] of cases) {
    const got = decide("Bash", { command });
    ok(
      (got?.[0] ?? null) === want,
      `decide(${JSON.stringify(command.slice(0, 60))}) => ${got?.[0] ?? "null"}, expected ${want ?? "null"}`,
    );
  }

  ok(decide("Read", { file_path: "x" }) === null, "Read was routed into the commit guard");
  ok(extractMessage('-m "Fix bug"') === "Fix bug", "simple -m extraction failed");
  ok(
    extractMessage(heredocClean).trim() === "Add media batch reprocessing",
    "heredoc extraction failed",
  );

  return done(cases.length + 3);
}

process.exit(main());
