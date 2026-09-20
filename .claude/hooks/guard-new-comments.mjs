#!/usr/bin/env node
// PreToolUse(Write|Edit|MultiEdit): denies a code edit that adds a comment line, unless the
// line is marked essential or falls under a small fixed allowlist (SPDX headers, the
// Arrange/Act/Assert test markers). Scoped to backend/web/app source files only.
//
// Escape hatch: `keep-comment:` anywhere on the line.
//
// Self-test: `node .claude/hooks/guard-new-comments.mjs --self-test`
import process from "node:process";
import { readFileSync } from "node:fs";
import { readEvent, repoRoot, relKey, under, deny, checker, lines } from "./lib.mjs";

const SOURCE_EXT = /\.(cs|ts|tsx)$/;
const EXCLUDE_DIRS = ["web/src/api/generated/", ".claude/", "docs/"];

const EXEMPT_LINE = [/SPDX-FileCopyrightText/, /SPDX-License-Identifier/, /^\/\/\s*(Arrange|Act|Assert)\b/i];
const ESCAPE = /keep-comment:/i;

function isCommentLine(line) {
  const t = line.trim();
  if (!t) return false;
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t === "*/";
}

function isExempt(line) {
  return ESCAPE.test(line) || EXEMPT_LINE.some((re) => re.test(line));
}

/** Comment lines present in `newText` but not (verbatim, trimmed) in `oldText`. */
export function addedComments(oldText, newText) {
  const before = new Set(lines(oldText ?? "").map((l) => l.trim()).filter(Boolean));
  const added = [];
  lines(newText ?? "").forEach((line, i) => {
    if (!isCommentLine(line) || isExempt(line)) return;
    const trimmed = line.trim();
    if (before.has(trimmed)) return;
    added.push({ line: i + 1, text: trimmed });
  });
  return added;
}

export function classify(keyIn, oldText, newText) {
  const key = String(keyIn).toLowerCase();
  if (!SOURCE_EXT.test(key)) return null;
  if (EXCLUDE_DIRS.some((d) => under(key, d))) return null;

  const added = addedComments(oldText, newText);
  if (!added.length) return null;

  const shown = added.slice(0, 5).map((c) => `  line ${c.line}: ${c.text}`).join("\n");
  const more = added.length > 5 ? `\n  ...and ${added.length - 5} more` : "";

  return [
    "deny",
    `${keyIn} adds ${added.length} comment line(s) that were not there before:\n${shown}${more}\n\n` +
      "Only add a comment when it captures something a reader could not get from the code " +
      "itself (a hidden constraint, a workaround, a non-obvious invariant). Do not restate " +
      "what the code does or narrate why a design was chosen.\n\n" +
      "If one of these is genuinely necessary, keep it and mark that line with:\n" +
      "  keep-comment: <why>\n" +
      "Otherwise remove it and retry. While in this file, also drop any other comment " +
      "nearby that is not carrying its weight.",
  ];
}

function fileText(root, key) {
  try {
    return readFileSync(`${root}/${key}`, "utf8");
  } catch {
    return "";
  }
}

function editsOf(toolName, input) {
  if (toolName === "Edit") return [[input?.old_string, input?.new_string]];
  if (toolName === "MultiEdit")
    return (Array.isArray(input?.edits) ? input.edits : []).map((e) => [e?.old_string, e?.new_string]);
  return null;
}

export function decide(toolName, input, root = repoRoot()) {
  if (!/^(Write|Edit|MultiEdit)$/.test(toolName)) return null;
  const raw = input?.file_path;
  const key = relKey(root, raw) ?? relKey("/", String(raw ?? "").replace(/\\/g, "/"));
  if (!key) return null;

  if (toolName === "Write") {
    const oldText = root ? fileText(root, key) : "";
    return classify(key, oldText, String(input?.content ?? ""));
  }

  const edits = editsOf(toolName, input);
  const oldAll = edits.map(([o]) => String(o ?? "")).join("\n");
  const newAll = edits.map(([, n]) => String(n ?? "")).join("\n");
  return classify(key, oldAll, newAll);
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const ev = readEvent();
  const d = decide(String(ev.tool_name ?? ""), ev.tool_input ?? {}, repoRoot(ev));
  return d ? deny(d[1]) : 0;
}

function selfTest() {
  const { ok, done } = checker("guard-new-comments");
  const CS = "backend/Core/Services/MediaReprocessService.cs";
  const CS_WIN = "backend\\Core\\Services\\MediaReprocessService.cs";
  const TS = "web/src/lib/media-reprocess.ts";

  // classify(key, oldText, newText) cases -----------------------------------
  const classifyCases = [
    // caught
    [CS, "var x = 1;", "// this explains what the line below does\nvar x = 1;", "deny"],
    [CS_WIN, "", "// a brand new narrative comment\nclass X {}", "deny"],
    [TS, "", "/** JSDoc-style narrative */\nexport const x = 1;", "deny"],
    // stays silent
    [CS, "// same comment\nvar x = 1;", "// same comment\nvar x = 2;", null], // unchanged comment
    [CS, "var x = 1;", "var x = 2;", null], // no comment at all
    [CS, "var x = 1;\n// old note\n", "var x = 2;\n", null], // comment REMOVED
    [CS, "", "// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors\n// SPDX-License-Identifier: AGPL-3.0-or-later\n", null],
    [CS, "", "// Arrange\nvar x = 1;", null],
    [CS, "", "// Act\nvar x = 1;", null],
    [CS, "", "// Assert\nvar x = 1;", null],
    [CS, "", "var url = \"https://example.com\"; // not a comment start", null],
    [CS, "", "// a necessary workaround keep-comment: EF requires this exact order\nvar x = 1;", null],
    ["docs/notes/some-note.md", "", "// a comment inside prose docs", null],
    ["web/src/api/generated/model/x.ts", "", "// generated narrative", null],
    [".claude/hooks/some-hook.mjs", "", "// hooks keep their own verbose style", null],
    ["backend/Tests/UnitTests/ServiceTests/X.cs", "", "// Arrange — seeds two rows for the comparison\nvar x = 1;", null],
  ];

  for (const [p, oldText, newText, want] of classifyCases) {
    const got = classify(p, oldText, newText);
    ok((got?.[0] ?? null) === want,
      `classify(${p}, ..., ${JSON.stringify(newText.slice(0, 40))}) => ${got?.[0] ?? "null"}, expected ${want ?? "null"}`);
  }

  // decide() per-tool wiring -------------------------------------------------
  const root = "/repo";
  ok(decide("Read", { file_path: CS }) === null, "Read was routed into the comment guard");
  ok(decide("Bash", { command: "grep -n TODO backend" }) === null, "Bash was routed into the comment guard");
  ok(
    decide("Edit", { file_path: CS, old_string: "x", new_string: "// new note\nx" }, root)?.[0] === "deny",
    "Edit adding a comment was not denied",
  );
  ok(
    decide("Edit", { file_path: CS, old_string: "// note\nx", new_string: "// note\ny" }, root) === null,
    "Edit keeping an existing comment was denied",
  );
  ok(
    decide(
      "MultiEdit",
      { file_path: CS, edits: [{ old_string: "a", new_string: "a" }, { old_string: "b", new_string: "// c\nb" }] },
      root,
    )?.[0] === "deny",
    "MultiEdit's second edit adding a comment was not denied",
  );
  // A brand-new file (nothing to read from disk) with only the mandatory header is fine.
  ok(
    decide("Write", { file_path: CS, content: "// SPDX-FileCopyrightText: x\n// SPDX-License-Identifier: y\nclass X {}" }, "/does/not/exist") === null,
    "a new file with only the SPDX header was denied",
  );

  return done(classifyCases.length + 6);
}

process.exit(main());
