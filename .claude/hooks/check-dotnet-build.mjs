#!/usr/bin/env node
// PostToolUse(Write|Edit): build the project owning the .cs file you just edited.
//
// backend/Directory.Build.props sets `WarningsAsErrors=nullable`, so a nullable slip is
// not a warning you can walk past — it is a build error. The feedback loop for one is
// otherwise the next full `dotnet test`, which is minutes and a lot of unrelated output
// away. A single-project incremental build costs ~1-2 s warm (measured in this tree:
// 5.2 s cold, 0.8 s with nothing to do), so the answer arrives in the same turn as the
// edit that caused it.
//
// WHY IT REPORTS PER FILE, and what that costs.  C# has no `gcc -fsyntax-only`: the
// compilation unit is the project, not the file, so there is no cheap way to ask "does
// this one file still compile". Building the project instead means the output can contain
// errors that have nothing to do with this edit. So:
//
//   * Errors IN THE EDITED FILE are reported in full. This does not distinguish one you
//     introduced from one that was already there at HEAD — `git diff` on that file
//     answers that in one command, and either way it is in your way.
//   * Errors ELSEWHERE in the project are reported as a COUNT only. That is the case
//     where an edit broke a consumer (a renamed member, a changed signature), which
//     matters, but attributing it from here would be a guess.
//
// Never blocks: exit 2 only puts the errors in front of Claude in the same turn.
//
// Self-test: `node .claude/hooks/check-dotnet-build.mjs --self-test`
//   drives the parser over VERBATIM compiler output captured from this repo (a planted
//   `s.Length` on a `string?` and a call to a name that does not exist). Add
//   `--with-compiler` to plant that defect for real and prove the whole path bites.
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { readEvent, repoRoot, relKey, run, speak, checker, lines } from "./lib.mjs";

const MAX_SHOWN = 8;

/** The nearest ancestor directory holding a .csproj, and that project's path. */
export function owningProject(root, relPath) {
  let dir = path.dirname(path.join(root, relPath));
  const stop = path.resolve(root);
  for (;;) {
    let hit = null;
    try {
      hit = readdirSync(dir).find((f) => f.endsWith(".csproj")) ?? null;
    } catch {
      /* unreadable */
    }
    if (hit) return path.join(dir, hit);
    const up = path.dirname(dir);
    if (up === dir || dir === stop) return null;
    dir = up;
  }
}

/**
 * Errors from `dotnet build` output, deduplicated.
 *
 * MSBuild prints each diagnostic TWICE (once per pass); a check that did not dedupe
 * would double every count it reports. Paths are normalised to POSIX so a Windows
 * build's `C:\...\File.cs(4,46)` compares against the same key as a Linux one.
 */
export function parseErrors(out) {
  const seen = new Map();
  for (const ln of lines(out)) {
    const m = ln.match(/^(.*?)\((\d+),(\d+)\):\s*error\s+([A-Z]+\d+):\s*(.*?)(?:\s*\[[^\]]*\])?\s*$/);
    if (!m) continue;
    const [, file, line, col, code, text] = m;
    const key = `${file.replace(/\\/g, "/")}|${line}|${col}|${code}`;
    if (!seen.has(key))
      seen.set(key, { file: file.replace(/\\/g, "/"), line: +line, col: +col, code, text });
  }
  return [...seen.values()];
}

/**
 * Split the errors into the ones in `relPath` and the count of the rest.
 *
 * Compared by SUFFIX, not by resolving both against the root: `path.resolve` on Linux
 * cannot parse `C:\\w\\repo` as a root, so a Windows build's absolute paths came out as
 * `/cwd/C:\\w\\repo/...` and attributed to nobody. A repo-relative path is specific
 * enough (`backend/Core/...`) that suffix matching has no realistic collision, and it
 * needs no notion of what a root looks like on the host.
 */
export function attribute(errors, root, relPath) {
  const target = "/" + String(relPath).replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
  const mine = [];
  let elsewhere = 0;
  for (const e of errors) {
    const abs = e.file.replace(/\\/g, "/").toLowerCase();
    if (abs.endsWith(target) || abs === target.slice(1)) mine.push(e);
    else elsewhere++;
  }
  return { mine, elsewhere };
}

export function render(relPath, project, mine, elsewhere) {
  const shown = mine.slice(0, MAX_SHOWN);
  const body = shown.map((e) => `  ${relPath}(${e.line},${e.col}): ${e.code}: ${e.text}`).join("\n");
  const more = mine.length > MAX_SHOWN ? `\n  (+${mine.length - MAX_SHOWN} more)` : "";
  const tail = elsewhere
    ? `\nAlso ${elsewhere} error(s) elsewhere in ${project} — an edit that changes a ` +
      "member's name or signature breaks its callers, so check whether those are yours."
    : "";
  if (!mine.length)
    return (
      `${relPath} itself compiles, but ${project} does not: ${elsewhere} error(s) in ` +
      "other files. If this edit renamed or re-signatured anything, those are its callers."
    );
  return (
    `${relPath} does not compile — ${mine.length} error(s) in that file, from building ` +
    `${project}:\n${body}${more}\n` +
    "Note that nullable warnings are ERRORS here (Directory.Build.props sets " +
    "WarningsAsErrors=nullable). Fix before moving on; the next `dotnet test` is " +
    "minutes away and will say the same thing." +
    tail
  );
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) return selfTest(argv.includes("--with-compiler"));
  const ev = readEvent();
  const raw = ev.tool_input?.file_path;
  if (!raw || !/\.cs$/i.test(String(raw))) return 0;
  const root = repoRoot(ev);
  if (!root) return 0;
  const rel = relKey(root, raw);
  // Migrations are EF's output and have their own guard; obj/bin are build artefacts.
  if (!rel || !/^backend\//.test(rel) || /(?:^|\/)(?:obj|bin)\//.test(rel)) return 0;
  if (/^backend\/infrastructure\/migrations\//.test(rel)) return 0;
  if (!existsSync(path.join(root, rel))) return 0;

  const project = owningProject(root, rel);
  if (!project) return 0;
  const r = run("dotnet", ["build", project, "--no-restore", "-v", "q", "--nologo"], {
    cwd: path.join(root, "backend"),
    timeout: 45_000,
  });
  if (!r || r.code === 0) return 0; // clean, or no dotnet on this box
  const { mine, elsewhere } = attribute(parseErrors(r.stdout + "\n" + r.stderr), root, rel);
  if (!mine.length && !elsewhere) return 0; // failed for a reason we cannot name
  return speak(render(rel, path.relative(root, project).replace(/\\/g, "/"), mine, elsewhere));
}

// Verbatim `dotnet build` output from this tree, from a planted `s.Length` on a `string?`
// and a call to an undeclared name. Kept as a fixture so the gate needs no compiler.
const FIXTURE = `
/w/stigvidd/backend/Core/Common/ZzTemp.cs(4,46): error CS8602: Dereference of a possibly null reference. [/w/stigvidd/backend/Core/Core.csproj]
/w/stigvidd/backend/Core/Common/ZzTemp.cs(5,34): error CS0103: The name 'NoSuchThing' does not exist in the current context [/w/stigvidd/backend/Core/Core.csproj]
/w/stigvidd/backend/Core/Common/ZzTemp.cs(4,46): error CS8602: Dereference of a possibly null reference. [/w/stigvidd/backend/Core/Core.csproj]
/w/stigvidd/backend/Core/Common/ZzTemp.cs(5,34): error CS0103: The name 'NoSuchThing' does not exist in the current context [/w/stigvidd/backend/Core/Core.csproj]
/w/stigvidd/backend/Core/Services/Other.cs(9,1): error CS1002: ; expected [/w/stigvidd/backend/Core/Core.csproj]
    5 Warning(s)
    5 Error(s)
`;

function selfTest(withCompiler) {
  const { ok, done } = checker("check-dotnet-build");
  let n = 0;

  const errs = parseErrors(FIXTURE);
  ok(errs.length === 3, `parse: ${errs.length} errors, expected 3 (MSBuild prints each twice)`);
  ok(errs.some((e) => e.code === "CS8602"), "the nullable-as-error diagnostic was not parsed");
  ok(errs.every((e) => !/\[/.test(e.text)), "the trailing [project] was left in the message");
  ok(parseErrors("    5 Error(s)\nBuild FAILED.").length === 0, "a summary line parsed as an error");
  n += 4;

  // Windows-shaped output must parse and attribute the same way.
  const win = parseErrors(
    String.raw`C:\w\stigvidd\backend\Core\Common\ZzTemp.cs(4,46): error CS8602: Dereference of a possibly null reference. [C:\w\stigvidd\backend\Core\Core.csproj]`,
  );
  ok(win.length === 1 && win[0].line === 4, "a Windows path did not parse");
  const winAttr = attribute(win, String.raw`C:\w\stigvidd`, "backend/Core/Common/ZzTemp.cs");
  ok(winAttr.mine.length === 1, "a Windows path did not attribute to the edited file");
  n += 2;

  const { mine, elsewhere } = attribute(errs, "/w/stigvidd", "backend/Core/Common/ZzTemp.cs");
  ok(mine.length === 2, `attribute: ${mine.length} in the edited file, expected 2`);
  ok(elsewhere === 1, `attribute: ${elsewhere} elsewhere, expected 1`);
  const msg = render("backend/Core/Common/ZzTemp.cs", "backend/Core/Core.csproj", mine, elsewhere);
  ok(/CS8602/.test(msg) && /elsewhere/.test(msg), "the message dropped the diagnostics or the count");
  ok(/WarningsAsErrors/.test(msg), "the message does not say nullable warnings are errors here");
  n += 4;

  // Project resolution against the real tree.
  const root = repoRoot({});
  if (root) {
    const p = owningProject(root, "backend/Core/Services/FacilityService.cs");
    ok(p !== null && /Core\.csproj$/.test(p), `owningProject resolved to ${p}`);
    ok(owningProject(root, "docs/notes/INDEX.md") === null ||
       !/\.csproj$/.test(owningProject(root, "docs/notes/INDEX.md") ?? ""),
       "a non-project path resolved to a project");
    n += 2;
  }

  // Opt-in: plant the defect for real and prove the whole path reports it.
  if (withCompiler && root) {
    const rel = "backend/Core/Common/ZzHookSelfTest.cs";
    const abs = path.join(root, rel);
    try {
      writeFileSync(abs, "namespace Core.Common;\ninternal static class ZzHookSelfTest\n{\n    internal static int L(string? s) => s.Length;\n}\n");
      const r = run("dotnet", ["build", owningProject(root, rel), "--no-restore", "-v", "q", "--nologo"],
                    { cwd: path.join(root, "backend"), timeout: 90_000 });
      const got = r ? attribute(parseErrors(r.stdout + "\n" + r.stderr), root, rel) : { mine: [] };
      ok(got.mine.some((e) => e.code === "CS8602"),
         "the planted nullable defect was NOT reported — the check does not bite");
      n++;
    } finally {
      rmSync(abs, { force: true });
    }
  }
  return done(n);
}

process.exit(main());
