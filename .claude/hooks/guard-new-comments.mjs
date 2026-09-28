#!/usr/bin/env node
// PreToolUse(Write|Edit|MultiEdit): denies a code edit that adds a comment line, unless the
// line is marked essential or falls under a small fixed allowlist (SPDX headers, app/'s
// MPL-2.0 notice, the Arrange/Act/Assert test markers). Scoped to backend/web/app source files only.
//
// Escape hatch: `keep-comment:` anywhere on the line.
//
// --after  PostToolUse(Write|Edit|MultiEdit): lists the file's OTHER unmarked comments, the
//          ones already there before this change, so old comments get reviewed as files
//          are touched. Never blocks (a deny would stop every Edit on comments it never
//          touched), and reports a file once per session. EF migrations are skipped: their
//          scaffolded `/// <inheritdoc />` is not anyone's to review.
//
// Self-test: `node .claude/hooks/guard-new-comments.mjs --self-test`
import process from "node:process";
import path from "node:path";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { readEvent, repoRoot, relKey, under, deny, speak, stateDir, checker, lines } from "./lib.mjs";

const SOURCE_EXT = /\.(cs|ts|tsx)$/;
const EXCLUDE_DIRS = ["web/src/api/generated/", ".claude/", "docs/"];

// The MPL-2.0 notice every app/ file carries under its SPDX lines, matched verbatim so a
// narrative comment cannot borrow the exemption.
const MPL_NOTICE = [
  "//",
  "// This Source Code Form is subject to the terms of the Mozilla Public License,",
  "// v. 2.0. If a copy of the MPL was not distributed with this file, You can",
  "// obtain one at https://mozilla.org/MPL/2.0/.",
];

const EXEMPT_LINE = [
  /SPDX-FileCopyrightText/,
  /SPDX-License-Identifier/,
  /^\/\/\s*(Arrange|Act|Assert)\b/i,
  ...MPL_NOTICE.map((l) => new RegExp(`^${l.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`)),
];
const ESCAPE = /keep-comment:/i;

function isCommentLine(line) {
  const t = line.trim();
  if (!t) return false;
  return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t === "*/";
}

function isExempt(line) {
  return ESCAPE.test(line) || EXEMPT_LINE.some((re) => re.test(line.trim()));
}

/** Comment lines present in `newText` but not (verbatim, trimmed) in `oldText`. */
export function addedComments(oldText, newText) {
  const before = new Set(lines(oldText ?? "").map((l) => l.trim()).filter(Boolean));
  const added = [];
  lines(newText ?? "").forEach((line, i) => {
    if (!isCommentLine(line)) return;
    const trimmed = line.trim();
    // Exemptions are tested against the TRIMMED line: EXEMPT_LINE anchors at ^// and every
    // real Arrange/Act/Assert marker is indented inside a method, so matching the raw line
    // exempted none of them. It only looked like it worked because a comment already present
    // in oldText is skipped below - which is the whole file for Write but just old_string for
    // Edit, so the same test methods were allowed one way and denied the other.
    if (isExempt(trimmed)) return;
    if (before.has(trimmed)) return;
    added.push({ line: i + 1, text: trimmed });
  });
  return added;
}

function inScope(key) {
  return SOURCE_EXT.test(key) && !EXCLUDE_DIRS.some((d) => under(key, d));
}

export function sweepScope(keyIn) {
  const key = String(keyIn).replace(/\\/g, "/").toLowerCase();
  return inScope(key) && !key.includes("/migrations/");
}

/** Every comment line in `text` that is neither exempt nor marked keep-comment. */
export function legacyComments(text) {
  const found = [];
  lines(text ?? "").forEach((line, i) => {
    const trimmed = line.trim();
    if (isCommentLine(line) && !isExempt(trimmed)) found.push({ line: i + 1, text: trimmed });
  });
  return found;
}

export function classify(keyIn, oldText, newText) {
  const key = String(keyIn).toLowerCase();
  if (!inScope(key)) return null;

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

const SWEEP_SHOWN = 15;

function sweepFile(dir, sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^A-Za-z0-9_-]/g, "_");
  return path.join(dir, `${safe}.json`);
}

function alreadySwept(dir, sessionId) {
  try {
    const keys = JSON.parse(readFileSync(sweepFile(dir, sessionId), "utf8"));
    return new Set(Array.isArray(keys) ? keys : []);
  } catch {
    return new Set();
  }
}

function markSwept(dir, sessionId, keys) {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(sweepFile(dir, sessionId), JSON.stringify([...keys]));
  } catch {
    /* best effort */
  }
}

/** The --after message for `key`, or null when there is nothing to say this session. */
export function sweep(key, text, sessionId, dir = path.join(stateDir(), "comment-sweep")) {
  if (!key || !sweepScope(key)) return null;
  const seen = alreadySwept(dir, sessionId);
  if (seen.has(key)) return null;
  const found = legacyComments(text);
  if (!found.length) return null;
  seen.add(key);
  markSwept(dir, sessionId, seen);

  const shown = found.slice(0, SWEEP_SHOWN).map((c) => `  line ${c.line}: ${c.text}`).join("\n");
  const more = found.length > SWEEP_SHOWN ? `\n  ...and ${found.length - SWEEP_SHOWN} more` : "";
  return (
    `${key} still has ${found.length} older comment line(s) with no keep-comment marker:\n` +
    `${shown}${more}\n\n` +
    "While you are in this file, review them. Delete each one that restates the code or " +
    "narrates history; keep only what a reader could not get from the code, and mark each " +
    "kept line with `keep-comment: <why>` (the marker is per line, so every line of a kept " +
    "block needs it). Leave unrelated code alone. Rewording a comment counts as adding one, " +
    "so a reworded line needs the marker too. This is not blocking, and this file will not " +
    "be listed again this session."
  );
}

function after() {
  const ev = readEvent();
  const root = repoRoot(ev);
  const raw = ev.tool_input?.file_path;
  const key = relKey(root, raw);
  if (!root || !key) return 0;
  const msg = sweep(key, fileText(root, key), ev.session_id);
  return msg ? speak(msg) : 0;
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  if (process.argv.includes("--after")) return after();
  const ev = readEvent();
  const d = decide(String(ev.tool_name ?? ""), ev.tool_input ?? {}, repoRoot(ev));
  return d ? deny(d[1]) : 0;
}

function selfTest() {
  const { ok, done } = checker("guard-new-comments");
  const CS = "backend/Core/Services/MediaReprocessService.cs";
  const CS_WIN = "backend\\Core\\Services\\MediaReprocessService.cs";
  const TS = "web/src/lib/media-reprocess.ts";
  const APP = "app/src/components/auth/new-thing.tsx";
  const APP_HEADER =
    "// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors\n" +
    "// SPDX-License-Identifier: MPL-2.0\n" +
    "//\n" +
    "// This Source Code Form is subject to the terms of the Mozilla Public License,\n" +
    "// v. 2.0. If a copy of the MPL was not distributed with this file, You can\n" +
    "// obtain one at https://mozilla.org/MPL/2.0/.\n";

  // classify(key, oldText, newText) cases -----------------------------------
  const classifyCases = [
    // caught
    [CS, "var x = 1;", "// this explains what the line below does\nvar x = 1;", "deny"],
    [CS_WIN, "", "// a brand new narrative comment\nclass X {}", "deny"],
    [TS, "", "/** JSDoc-style narrative */\nexport const x = 1;", "deny"],
    [APP, "", `${APP_HEADER}\n// narrative after the notice\nexport const x = 1;`, "deny"],
    [APP, "", "// This Source Code Form is subject to the terms of the Mozilla Public License, and more\nexport const x = 1;", "deny"], // near-miss of a notice line
    // stays silent
    [CS, "// same comment\nvar x = 1;", "// same comment\nvar x = 2;", null], // unchanged comment
    [CS, "var x = 1;", "var x = 2;", null], // no comment at all
    [CS, "var x = 1;\n// old note\n", "var x = 2;\n", null], // comment REMOVED
    [CS, "", "// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors\n// SPDX-License-Identifier: AGPL-3.0-or-later\n", null],
    [APP, "", `${APP_HEADER}\nexport const x = 1;`, null], // the full MPL notice of a new app file
    [APP, "", APP_HEADER.replace(/\n/g, "\r\n") + "\r\nexport const x = 1;", null], // CRLF, as Windows writes it
    [CS, "", "// Arrange\nvar x = 1;", null],
    [CS, "", "// Act\nvar x = 1;", null],
    [CS, "", "// Assert\nvar x = 1;", null],
    // Indented, which is where every real marker sits. A flush-left fixture never reaches
    // the ^ anchor these exemptions are written with.
    [CS, "", "        // Arrange\n        var x = 1;", null],
    [CS, "", "        // Act\n        var x = 1;", null],
    [CS, "", "        // Assert\n        x.Should().Be(1);", null],
    [CS, "", "\t// Arrange\n\tvar x = 1;", null],
    [CS, "", "        // a narrative comment that happens to be indented\n        var x = 1;", "deny"],
    [CS, "", "        // indented but escaped keep-comment: the order matters\n        var x = 1;", null],
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
  ok(
    decide("Write", { file_path: APP, content: `${APP_HEADER}\nexport const x = 1;` }, "/does/not/exist") === null,
    "a new app file with the SPDX header and MPL notice was denied",
  );

  // --after: the sweep of older comments ------------------------------------
  const legacyCases = [
    ["// narrative\nvar x = 1;", 1],
    ["/** JSDoc narrative\n * second line\n */\nexport const x = 1;", 3],
    ["    public void M()\n    {\n        // indented narrative\n    }", 1],
    ["// SPDX-FileCopyrightText: x\n// SPDX-License-Identifier: AGPL-3.0-or-later\nclass X {}", 0],
    [`${APP_HEADER}\nexport const x = 1;`, 0],
    [APP_HEADER.replace(/\n/g, "\r\n") + "\r\nexport const x = 1;", 0],
    ["        // Arrange\n        // Act\n        // Assert\n", 0],
    ["        // kept keep-comment: EF needs this order\n", 0],
    ["var x = 1; // trailing, not a comment line", 0],
  ];
  for (const [text, want] of legacyCases) {
    const got = legacyComments(text).length;
    ok(got === want, `legacyComments(${JSON.stringify(text.slice(0, 40))}) found ${got}, expected ${want}`);
  }

  const scopeCases = [
    [CS, true],
    [CS_WIN, true],
    [TS, true],
    [APP, true],
    ["docs/notes/x.ts", false],
    ["web/src/api/generated/model/x.ts", false],
    [".claude/hooks/x.ts", false],
    ["backend/Infrastructure/Migrations/20260925113659_AddUserBlocksAndBans.cs", false],
    ["backend\\Infrastructure\\Migrations\\X.cs", false],
    ["backend/Core/Services/x.md", false],
  ];
  for (const [p, want] of scopeCases) ok(sweepScope(p) === want, `sweepScope(${p}) => ${!want}, expected ${want}`);

  const dir = mkdtempSync(path.join(tmpdir(), "comment-sweep-test-"));
  try {
    const text = "// old narrative\nvar x = 1;";
    const first = sweep(CS, text, "s1", dir);
    ok(first?.includes("line 1: // old narrative") ?? false, "first sweep of a file did not list its comment");
    ok(sweep(CS, text, "s1", dir) === null, "the same file was swept twice in one session");
    ok(sweep(TS, text, "s1", dir) !== null, "a second file in the same session was not swept");
    ok(sweep(CS, text, "s2", dir) !== null, "a new session did not sweep the file again");
    ok(sweep(APP, "export const x = 1;", "s3", dir) === null, "a file with no comments was swept");
    ok(sweep(APP, "// now one\n", "s3", dir) !== null, "a clean file blocked a later sweep in the session");
    const many = Array.from({ length: 20 }, (_, i) => `// c${i}`).join("\n");
    ok(sweep(CS, many, "s4", dir)?.includes("...and 5 more") ?? false, "a long listing was not truncated");
    ok(sweep(null, text, "s5", dir) === null, "a missing path was swept");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  return done(classifyCases.length + 7 + legacyCases.length + scopeCases.length + 8);
}

process.exit(main());
