#!/usr/bin/env node
// PreToolUse(Write|Edit|MultiEdit): the half of xUnit1051 the analyzer cannot see.
//
// xunit.analyzers ships xUnit1051 — "calls to methods which accept CancellationToken
// should use TestContext.Current.CancellationToken" — and .editorconfig raises it to an
// ERROR for backend/Tests/**.cs, so an OMITTED token now fails the build. That is the
// better instrument and this hook deliberately does not duplicate it.
//
// What the analyzer does NOT flag is a token that was passed, just not the right one:
//
//     await repo.GetPendingIdsAsync(CancellationToken.None);    // clean to xUnit1051
//     await repo.GetPendingIdsAsync(TestContext.Current.CancellationToken);
//
// Measured on this repo: the backend build reported 0 warnings while 792 occurrences of
// `CancellationToken.None` sat across 37 test files, because every one of them supplied
// an argument. The analyzer only ever looks at the optional parameter you left off.
// See docs/notes/xunit1051-misses-an-explicit-cancellationtoken-none.md.
//
// So this guard is textual and narrow on purpose: it denies writing an explicit
// never-cancelled token into backend/Tests/**.cs, and stays silent on everything else —
// production code under backend/Core, a CancellationTokenSource (which is how you write
// a test ABOUT cancellation), and `It.IsAny<CancellationToken>()` in a Moq setup.
//
// Escape hatch, because a guard with no way out is a guard that gets switched off: a
// `// cancellation-token-ok: <reason>` comment on the same line is honoured.
//
// Self-test: `node .claude/hooks/guard-test-cancellation-token.mjs --self-test`
import process from "node:process";
import { readEvent, repoRoot, relKey, under, deny, checker, lines } from "./lib.mjs";

const TESTS_DIR = "backend/tests";

// Each is a token that can never be cancelled. CancellationTokenSource is deliberately
// NOT here: `new CancellationTokenSource()` is how a test about cancellation is written,
// and `new CancellationToken()` cannot match it — the next character is `S`, not `(`.
const BANNED = [
  [/\bCancellationToken\s*\.\s*None\b/, "CancellationToken.None"],
  [/\bnew\s+CancellationToken\s*\(\s*\)/, "new CancellationToken()"],
  [/\bdefault\s*\(\s*CancellationToken\s*\)/, "default(CancellationToken)"],
];

const ALLOW_COMMENT = /\/\/\s*cancellation-token-ok\b/;

/** Every offending line in a block of C# the tool is about to write. */
export function offenders(text) {
  const out = [];
  lines(text ?? "").forEach((line, i) => {
    if (ALLOW_COMMENT.test(line)) return;
    for (const [re, what] of BANNED) {
      if (re.test(line)) {
        out.push({ line: i + 1, what, text: line.trim() });
        return;
      }
    }
  });
  return out;
}

/** The text this tool call would introduce — Write, Edit and MultiEdit each differ. */
export function writtenText(toolName, input) {
  if (toolName === "Write") return String(input?.content ?? "");
  if (toolName === "Edit") return String(input?.new_string ?? "");
  if (toolName === "MultiEdit")
    return (Array.isArray(input?.edits) ? input.edits : [])
      .map((e) => String(e?.new_string ?? ""))
      .join("\n");
  return "";
}

export function decide(toolName, input) {
  if (!/^(Write|Edit|MultiEdit)$/.test(toolName)) return null;
  const raw = input?.file_path;
  const root = repoRoot();
  const key = relKey(root, raw) ?? relKey("/", String(raw ?? "").replace(/\\/g, "/"));
  if (!key) return null;
  return classify(key, writtenText(toolName, input));
}

/**
 * Split out so the self-test drives it with repo-relative keys directly.
 *
 * Lowercased UNCONDITIONALLY rather than through fold(): `backend/Tests` is a fixed repo
 * path spelled the same on every platform, so matching it is a string question, not a
 * filesystem one — and fold() is a no-op off win32, which would leave this dead on Linux.
 */
export function classify(keyIn, text) {
  const key = String(keyIn).toLowerCase();
  if (!under(key, TESTS_DIR) || !key.endsWith(".cs")) return null;

  const bad = offenders(text);
  if (!bad.length) return null;

  const shown = bad
    .slice(0, 5)
    .map((b) => `  line ${b.line}: ${b.text}`)
    .join("\n");
  const more = bad.length > 5 ? `\n  ...and ${bad.length - 5} more` : "";

  return [
    "deny",
    `${keyIn} would pass a token that can never be cancelled:\n${shown}${more}\n\n` +
      "In a test, use the token xunit cancels when the run is cancelled:\n" +
      "  TestContext.Current.CancellationToken\n\n" +
      "xUnit1051 will NOT catch this — it only flags a token left OFF entirely, and an " +
      "explicit CancellationToken.None reads as clean to it. That is why this is a hook " +
      "and not just the analyzer.\n" +
      "For a Moq setup, match any token instead: It.IsAny<CancellationToken>().\n" +
      "If a never-cancelled token is genuinely the thing under test, say so on the line:" +
      "\n  // cancellation-token-ok: <why>",
  ];
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const ev = readEvent();
  const d = decide(String(ev.tool_name ?? ""), ev.tool_input ?? {});
  return d ? deny(d[1]) : 0;
}

function selfTest() {
  const { ok, done } = checker("guard-test-cancellation-token");
  const T = "backend/Tests/UnitTests/ServiceTests/HikeServiceTests.cs";
  const TWIN = "backend\\Tests\\UnitTests\\ServiceTests\\HikeServiceTests.cs";

  const cases = [
    // --- caught -------------------------------------------------------------
    [T, "var r = await service.GetAsync(id, CancellationToken.None);", "deny"],
    // The Windows shape, which is what the Edit tool sends there. Matching only the
    // POSIX form fails OPEN on Windows, and this is Linux CI's only cover for that.
    [TWIN, "var r = await service.GetAsync(id, CancellationToken.None);", "deny"],
    [T, "await repo.AddAsync(e, new CancellationToken());", "deny"],
    [T, "await repo.AddAsync(e, default(CancellationToken));", "deny"],
    [T, "await repo.AddAsync(e, CancellationToken . None);", "deny"],
    [T, "using var db = await factory.CreateDbContextAsync(CancellationToken.None);", "deny"],
    // Helper methods in a test file are in scope too: TestContext.Current flows into
    // them through AsyncLocal, and the analyzer never looks at a non-[Fact] body.
    [T, "private static Task Seed(Db db) => db.SaveChangesAsync(CancellationToken.None);", "deny"],

    // --- must stay silent ---------------------------------------------------
    [T, "var r = await service.GetAsync(id, TestContext.Current.CancellationToken);", null],
    // A test ABOUT cancellation needs a real source; `new CancellationToken()` cannot
    // match `new CancellationTokenSource()`, and this pins that.
    [T, "using var cts = new CancellationTokenSource();", null],
    [T, "var cts = new CancellationTokenSource(); cts.Cancel();", null],
    [T, "repo.Setup(r => r.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))", null],
    [T, "result.IsSuccess.Should().BeTrue();", null],
    // The escape hatch.
    [T, "await Sut.Run(CancellationToken.None); // cancellation-token-ok: asserts the default", null],
    // Production code is not a test: CancellationToken.None is legitimate there.
    ["backend/Core/Services/HikeService.cs", "await x.GetAsync(CancellationToken.None);", null],
    ["backend/StigviddAPI/Program.cs", "await host.RunAsync(CancellationToken.None);", null],
    // Non-C# under the test tree, and the test tree's own name as a substring elsewhere.
    ["backend/Tests/IntegrationTests/appsettings.json", "CancellationToken.None", null],
    ["web/src/lib/backend/tests/x.cs", "CancellationToken.None", null],
  ];

  for (const [p, text, want] of cases) {
    const got = classify(p.replace(/\\/g, "/"), text);
    ok(
      (got?.[0] ?? null) === want,
      `classify(${p}, ${JSON.stringify(text.slice(0, 48))}) => ${got?.[0] ?? "null"}, expected ${want ?? "null"}`,
    );
    if (want) {
      ok((got?.[1] ?? "").includes("TestContext.Current.CancellationToken"),
         `${p} denied without naming the token that works`);
      ok(/line \d+:/.test(got?.[1] ?? ""), `${p} denied without pointing at a line`);
    }
  }

  // CRLF, because this repo has had both and lines() is what makes the split agnostic.
  ok(offenders("ok();\r\nawait X(CancellationToken.None);\r\n")[0]?.line === 2,
     "CRLF input did not report the right line number");
  // Only the first banned form per line is reported, so a count stays a line count.
  ok(offenders("await X(CancellationToken.None, default(CancellationToken));").length === 1,
     "one line reported more than once");

  // Per-tool input shapes. Reading the wrong field yields undefined and a hook that
  // silently never fires — the single most common way one of these guards dies.
  ok(writtenText("Write", { content: "a" }) === "a", "Write reads content");
  ok(writtenText("Edit", { new_string: "b" }) === "b", "Edit reads new_string");
  ok(writtenText("MultiEdit", { edits: [{ new_string: "c" }, { new_string: "d" }] }) === "c\nd",
     "MultiEdit reads every edit's new_string");
  // An Edit's OLD text is not what is being written: removing a bad line must not deny.
  ok(decide("Edit", { file_path: T, old_string: "X(CancellationToken.None);", new_string: "X(TestContext.Current.CancellationToken);" }) === null,
     "removing an offending line was denied");
  // Tool gate: reading or grepping a file full of them is fine.
  ok(decide("Read", { file_path: T }) === null, "Read was routed into the write guard");
  ok(decide("Bash", { command: "grep -rn CancellationToken.None backend/Tests" }) === null,
     "Bash was routed into the write guard");

  return done(cases.length + 8);
}

process.exit(main());
