#!/usr/bin/env node
// PreToolUse(Bash): the invocations that fail for a reason unrelated to your change.
//
//   * `dotnet test` WITHOUT ConnectionStrings__StigVidd.  Program.cs does
//
//         GetConnectionString("StigVidd") ?? throw new InvalidOperationException(...)
//
//     and the integration tests boot the real host through WebApplicationFactory, so
//     every one of them fails at startup with a message about configuration.  Nothing in
//     the output points at the missing variable being the cause, and the suite that
//     "broke" is the one you were about to trust.  Both .github/workflows/ci.yml and the
//     Jenkinsfile set it to DataSource=:memory: — WebApplicationFactory swaps in SQLite
//     regardless, so the value only has to satisfy the null-check.
//
//     This is decidable rather than guessed: shell state does not persist between Bash
//     tool calls, so an `export` in an earlier call is already gone, and what the command
//     itself assigns plus what this hook sees in its own environment is the whole of what
//     that `dotnet test` will inherit.
//
//   * `dotnet ef` WITHOUT --project.  Measured in this tree: from backend/ it exits with
//     "No project was found. Change the current working directory or use the --project
//     option." The DbContext and its IDesignTimeDbContextFactory
//     (Infrastructure/Data/DesignTimeDbContextFactory.cs) both live in Infrastructure, so
//     --project Infrastructure is the answer and no --startup-project is needed.
//
//   * `dotnet build`/`test` with no project in scope is WARNED about, not denied: the
//     repo root has no .sln (backend/backend.sln does) so it fails with MSB1003, but a
//     hook cannot see the Bash tool's own working directory and a false deny is worse
//     than a false line of text.
//
// Self-test: `node .claude/hooks/guard-build-commands.mjs --self-test`
import process from "node:process";
import { readEvent, commandsIn, invokes, envNamesSet, deny, speak, checker } from "./lib.mjs";

const CONN = "ConnectionStrings__StigVidd";

const CONN_FORMS =
  `  bash        ${CONN}="DataSource=:memory:" dotnet test --no-build\n` +
  `  PowerShell  $env:${CONN}="DataSource=:memory:"; dotnet test --no-build\n` +
  `  cmd         set ${CONN}=DataSource=:memory: && dotnet test --no-build`;

/**
 * @param command the Bash tool's command string
 * @param env     names already set in the environment this command will inherit
 * @param cwd     the session cwd, or null
 * @param root    the repo root, or null
 */
export function decide(command, env, cwd = null, root = null) {
  if (!command) return null;

  const test = invokes(command, "dotnet", "test");
  if (test && !env.has(CONN) && !envNamesSet(command).has(CONN))
    return [
      "deny",
      `\`dotnet test\` here needs ${CONN} set, or every integration test fails at ` +
        "host startup — Program.cs throws InvalidOperationException on the missing " +
        "connection string, and nothing in the failure names it as the cause.\n" +
        "WebApplicationFactory swaps in SQLite in-memory anyway, so the value only has " +
        "to satisfy the null-check (this is what CI and Jenkins both do):\n" +
        CONN_FORMS,
    ];

  const ef = invokes(command, "dotnet", "ef");
  if (ef && !/\s--project(?:=|\s)/.test(ef))
    return [
      "deny",
      "`dotnet ef` without --project exits with \"No project was found\" — measured in " +
        "this tree, from backend/.\n" +
        "The DbContext and its IDesignTimeDbContextFactory both live in Infrastructure:\n" +
        `  cd backend && ${ef.trim()} --project Infrastructure\n` +
        "No --startup-project is needed: the design-time factory supplies the context, " +
        "reading the connection string from Infrastructure's user secrets (which only " +
        "the commands that actually connect, like `database update`, require).",
    ];

  // Heuristic, so it warns rather than blocks — see the header.
  const build = invokes(command, "dotnet", "build") || invokes(command, "dotnet", "restore") || test;
  if (build && root && cwd && !/(?:^|\s)cd\s/.test(command) && !/\.(?:sln|csproj)\b/.test(command)) {
    const norm = (s) => String(s).replace(/\\/g, "/").replace(/\/+$/, "");
    if (norm(cwd) === norm(root))
      return [
        "warn",
        "There is no .sln or .csproj at the repo root, so a bare `dotnet` command here " +
          "fails with MSB1003 rather than building anything. The solution is " +
          "backend/backend.sln — run it from backend/, or name the project.",
      ];
  }
  return null;
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const ev = readEvent();
  if (String(ev.tool_name ?? "") !== "Bash") return 0;
  const root = process.env.CLAUDE_PROJECT_DIR ?? null;
  const d = decide(
    String(ev.tool_input?.command ?? ""),
    new Set(Object.keys(process.env)),
    ev.cwd ?? null,
    root,
  );
  if (!d) return 0;
  return d[0] === "deny" ? deny(d[1]) : speak(d[1]);
}

function selfTest() {
  const { ok, done } = checker("guard-build-commands");
  const bare = new Set();
  const preset = new Set([CONN]);
  const cases = [
    // The connection string, in each shell's syntax — all three must count as set.
    ["cd backend && dotnet test", bare, "deny"],
    ["cd backend && dotnet test --no-build", bare, "deny"],
    ["dotnet test", preset, null],
    [`${CONN}="DataSource=:memory:" dotnet test --no-build`, bare, null],
    [`$env:${CONN}="DataSource=:memory:"; dotnet test`, bare, null],
    [`set ${CONN}=DataSource=:memory: && dotnet test`, bare, null],
    // A prefix run must not hide the dotnet test behind it.
    [`env -u FOO timeout -k 5 600 dotnet test`, bare, "deny"],
    ["nice -n 10 dotnet test", bare, "deny"],
    // dotnet ef needs --project.
    ["cd backend && dotnet ef migrations add Foo", bare, "deny"],
    ["cd backend && dotnet ef migrations add Foo --project Infrastructure", bare, null],
    ["cd backend && dotnet ef dbcontext list --project=Infrastructure", bare, null],
    // Must stay silent on everything ordinary.
    ["cd backend && dotnet build", bare, null],
    ["git status", bare, null],
    ["npm run lint", bare, null],
    ["cat backend/StigviddAPI/Program.cs", bare, null],
    // A mention inside a quoted string is not an invocation.
    ["echo 'run dotnet test later'", bare, null],
  ];
  for (const [cmd, env, want] of cases) {
    const got = decide(cmd, env);
    ok((got?.[0] ?? null) === want, `decide(${cmd}) => ${got?.[0] ?? "null"}, want ${want ?? "null"}`);
  }
  // The deny must carry all three shell forms: two of them are wrong on any given box,
  // and a session on Windows that is handed only the bash form is handed a broken command.
  const msg = decide("dotnet test", bare)?.[1] ?? "";
  for (const form of [`${CONN}="DataSource`, `$env:${CONN}=`, `set ${CONN}=`])
    ok(msg.includes(form), `the connection-string deny is missing the form: ${form}`);
  // The root-directory warning fires only where it is true.
  ok(decide("dotnet build", preset, "/r", "/r")?.[0] === "warn", "root-dir warning did not fire");
  ok(decide("dotnet build", preset, "/r/backend", "/r") === null, "root-dir warning fired from backend/");
  ok(decide("dotnet build", preset, "\\r", "/r")?.[0] === "warn", "root-dir warning missed the Windows separator");
  // The suggested command must carry the WHOLE original invocation: an earlier version
  // reconstructed it from the verb alone and silently dropped the migration's name, so the
  // command it offered could not be pasted.
  const efMsg = decide("cd backend && dotnet ef migrations add AddFacilityPoint", bare)?.[1] ?? "";
  ok(/dotnet ef migrations add AddFacilityPoint --project Infrastructure/.test(efMsg),
     `the dotnet ef suggestion lost part of the command: ${efMsg.split("\n")[2] ?? ""}`);
  return done(cases.length + 7);
}

process.exit(main());
