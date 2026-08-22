#!/usr/bin/env node
// PreToolUse(Bash): commands that never return, run in the foreground.
//
// Every entry below is a server, a watcher or a log follower — it runs until something
// kills it. In the foreground that is not a slow command, it is a WEDGED TURN: the tool
// call sits until it times out, the output is a partial startup banner, and the session
// has to reconstruct what happened from it. The Bash tool has `run_in_background: true`
// for exactly this, and docker compose has `-d`.
//
// The cost of a false positive here is one denied call that is re-issued with a flag, so
// this guard is deliberately eager. The cost of a miss is a dead turn.
//
// Self-test: `node .claude/hooks/guard-long-running.mjs --self-test`
import process from "node:process";
import { readEvent, commandsIn, deny, checker } from "./lib.mjs";

// [matcher, what it is, how to run it instead]
const NEVER_RETURNS = [
  [/^expo\s+start\b/i, "the Expo dev server", "run_in_background: true"],
  [/^expo\s+run:(?:android|ios)\b/i, "an Expo native build + dev server", "run_in_background: true"],
  [/^vite\b(?!\s+build)/i, "the Vite dev server", "run_in_background: true"],
  [/^dotnet\s+watch\b/i, "a file watcher", "run_in_background: true, or drop `watch`"],
  [/^dotnet\s+run\b/i, "the API host", "run_in_background: true"],
  [/^npm\s+start\b/i, "`expo start` in app/ — the Expo dev server", "run_in_background: true"],
  [/^npm\s+run\s+(?:dev|preview)\b/i, "the Vite dev server in web/", "run_in_background: true"],
  [/^npm\s+run\s+(?:web|android|ios)\b/i, "an Expo dev server in app/", "run_in_background: true"],
];

export function decide(command) {
  if (!command) return null;
  for (const seg of commandsIn(command)) {
    for (const [re, what, how] of NEVER_RETURNS)
      if (re.test(seg)) return [seg.split(/\s+/).slice(0, 3).join(" "), what, how];

    // jest watch mode. A lookahead for `--watch(All)?` NOT followed by `=false` looks
    // right and is not: the regex matches `--watch`, leaves `All` unconsumed, and the
    // lookahead then passes on the `A`. So disable-first, test-after — the self-test's
    // `--watchAll=false` rows are what caught it.
    if (/^(?:jest\b|npm\s+(?:test|t)\b|npm\s+run\s+test\b)/i.test(seg)) {
      const flags = seg.replace(/--watch(?:All)?=false\b/gi, "");
      if (/--watch(?:All)?\b/i.test(flags))
        return [
          seg.split(/\s+/).slice(0, 2).join(" "),
          "jest in watch mode",
          seg.startsWith("npm") ? "-- --watchAll=false" : "--watchAll=false",
        ];
    }

    // `docker compose up` blocks unless detached; `logs -f` follows forever. Both have a
    // flag, so they are worth separating from the table for the sake of the message.
    if (/^docker\s+compose\b/i.test(seg)) {
      if (/\bup\b/.test(seg) && !/(?:^|\s)(?:-d|--detach)(?:\s|$)/.test(seg))
        return ["docker compose up", "the whole stack in the foreground", "-d"];
      if (/\blogs\b/.test(seg) && /(?:^|\s)(?:-f|--follow)(?:\s|$)/.test(seg))
        return ["docker compose logs -f", "a log follower", "--tail=N without -f"];
    }
  }
  return null;
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const ev = readEvent();
  if (String(ev.tool_name ?? "") !== "Bash") return 0;
  const d = decide(String(ev.tool_input?.command ?? ""));
  if (!d) return 0;
  const [what, is, how] = d;
  return deny(
    `\`${what}\` is ${is} — in the foreground it does not return, so this turn wedges ` +
      `until the tool times out and all you get back is a startup banner.\n` +
      `Run it with ${how}, then poll the output.`,
  );
}

function selfTest() {
  const { ok, done } = checker("guard-long-running");
  const cases = [
    ["cd app && npx expo start", true],
    ["CI=1 npx expo start", true],                       // bash prefix
    ['$env:CI="1"; npx expo start', true],               // PowerShell prefix
    ["set CI=1 && npx expo start", true],                // cmd prefix
    ["cd app && npm start", true],
    ["cd web && npm run dev", true],
    ["cd backend/StigviddAPI && dotnet run", true],
    ["dotnet watch run", true],
    ["docker compose up", true],
    ["docker compose up --build", true],
    ["docker compose logs -f api", true],
    ["cd app && npx jest --watch", true],
    ["cd app && npm test -- --watchAll", true],
    // Must stay silent: each of these terminates.
    ["docker compose up -d", false],
    ["docker compose up -d --build", false],
    ["docker compose --detach up", false],
    ["docker compose logs --tail=50 api", false],
    ["docker compose ps", false],
    ["cd web && npm run build", false],
    ["cd web && vite build", false],
    ["cd app && npm test -- --watchAll=false", false],
    ["cd app && npx jest --watchAll=false", false],
    ["cd backend && dotnet build", false],
    ["git log --oneline -5", false],
    ["echo 'do not docker compose up here'", false],
  ];
  for (const [cmd, want] of cases) {
    const got = decide(cmd) !== null;
    ok(got === want, `decide(${cmd}) => ${got}, want ${want}`);
  }
  // The three shell prefixes are the ones that fail OPEN when unhandled, so assert the
  // denial names the underlying command rather than the prefix.
  for (const cmd of ["CI=1 npx expo start", '$env:CI="1"; npx expo start', "set CI=1 && npx expo start"])
    ok((decide(cmd)?.[0] ?? "").startsWith("expo start"), `prefix form not resolved to the command: ${cmd}`);
  return done(cases.length + 3);
}

process.exit(main());
