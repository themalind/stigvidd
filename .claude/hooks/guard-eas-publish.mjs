#!/usr/bin/env node
// PreToolUse(Bash|PowerShell): every OTA publish goes through app/scripts/publish-update.mjs, and
// anything else that changes what production users run is left to the user.
//
// Self-test: `node .claude/hooks/guard-eas-publish.mjs --self-test`
import process from "node:process";
import { readEvent, deny, checker, commandsIn } from "./lib.mjs";

const PUBLISH_SUBS = new Set(["update", "update:republish", "update:rollback", "update:roll-back-to-embedded"]);
const ENV_WRITE_SUBS = new Set(["env:create", "env:update", "env:delete", "env:push"]);

const USE_SCRIPT =
  "OTA updates are published only through the checked script, which verifies git, the EAS variables and the built bundle: " +
  '`cd app && npm run publish:preview -- --message "…"` or `npm run publish:production -- --message "…"` ' +
  "(add --dry-run to check without uploading). A rollback is the user's call: give her the command.";
const PRODUCTION_IS_HERS =
  "This changes what production users run, so the user runs it herself: give her the exact command (as `! …`). " +
  "If it changes an expected value, update ENVIRONMENTS in app/scripts/publish-checks.mjs in the same change.";

// The command up to the first separator, so a flag of a later command is not read as this one's.
function ownSegment(seg) {
  return seg.split(/&&|\|\||[;|\n]/, 1)[0];
}

function easCall(seg) {
  const words = ownSegment(seg).trim().split(/\s+/);
  const base = (words[0] ?? "").replace(/\\/g, "/").split("/").pop().toLowerCase();
  if (!/^eas(-cli)?(\.(cmd|exe|ps1))?$/.test(base)) return null;
  return { sub: (words[1] ?? "").toLowerCase(), words: words.slice(2) };
}

function mentionsProduction(words) {
  return words.some((w) => /^(--[a-z-]+=)?["']?production["']?$/i.test(w));
}

export function decide(toolName, input) {
  if (toolName !== "Bash" && toolName !== "PowerShell") return null;
  const command = String(input?.command ?? "");

  for (const seg of commandsIn(command)) {
    const own = ownSegment(seg);
    if (/publish-update\.mjs\s+production|publish:production/.test(own) && /\s--yes\b/.test(own)) {
      return ["deny", `publish:production --yes skips the user's confirmation. ${PRODUCTION_IS_HERS}`];
    }

    const call = easCall(seg);
    if (!call || call.words.includes("--help") || call.words.includes("-h")) continue;
    if (PUBLISH_SUBS.has(call.sub)) return ["deny", `\`eas ${call.sub}\` directly is not allowed. ${USE_SCRIPT}`];
    if (ENV_WRITE_SUBS.has(call.sub) && mentionsProduction(call.words)) {
      return ["deny", `\`eas ${call.sub}\` touches the production environment. ${PRODUCTION_IS_HERS}`];
    }
    if (call.sub === "build" && mentionsProduction(call.words)) {
      return ["deny", `A production \`eas build\` goes to the stores. ${PRODUCTION_IS_HERS}`];
    }
    if (call.sub === "submit") return ["deny", `\`eas submit\` sends a build to the stores. ${PRODUCTION_IS_HERS}`];
  }
  return null;
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  const ev = readEvent();
  const d = decide(String(ev.tool_name ?? ""), ev.tool_input ?? {});
  return d ? deny(d[1]) : 0;
}

function selfTest() {
  const { ok, done } = checker("guard-eas-publish");

  const cases = [
    ['eas update --branch production --message "x"', "deny"],
    ['eas update --branch preview --environment preview -m "x"', "deny"],
    ['cd /d/projekt/stigvidd/app && timeout 300 eas update:republish --group abc --non-interactive', "deny"],
    ["npx eas-cli update --branch preview", "deny"],
    ["eas update:rollback", "deny"],
    ['$env:EXPO_NO_DOTENV="1"; eas update --branch preview', "deny"],
    ["set CI=1 && eas update --auto", "deny"],
    ["C:\\Users\\x\\AppData\\Roaming\\npm\\eas.cmd update --branch production", "deny"],
    ["eas env:create production --name X --value y --visibility plaintext", "deny"],
    ["eas env:update preview --variable-name X --environment preview --environment production", "deny"],
    ["eas env:delete --variable-environment=production --variable-name X", "deny"],
    ["eas build --profile production --platform ios", "deny"],
    ["eas submit -p ios --latest", "deny"],
    ['npm run publish:production -- --message "x" --yes', "deny"],
    ["node scripts/publish-update.mjs production --yes -m x", "deny"],
    ["eas update:list --branch production --limit 5", null],
    ["eas update:view abc --json", null],
    ["eas update --help", null],
    ["eas env:list --environment production --format long", null],
    ["eas env:pull --environment preview --path /tmp/x", null],
    ["eas env:update preview --variable-name X --environment preview --non-interactive", null],
    ["eas env:create preview --name X --value y", null],
    ["eas build --profile preview --platform android", null],
    ["eas build:list --limit 15 --json", null],
    ['npm run publish:production -- --message "x"', null],
    ["npm run publish:production -- --dry-run", null],
    ['npm run publish:preview -- --message "x" --yes', null],
    ['echo "eas update --branch production"', null],
    ["git log --oneline -5", null],
    ["eas env:list --environment preview && echo production", null],
  ];

  for (const [command, want] of cases) {
    const got = decide("Bash", { command });
    ok(
      (got?.[0] ?? null) === want,
      `decide(${JSON.stringify(command.slice(0, 70))}) => ${got?.[0] ?? "null"}, expected ${want ?? "null"}`,
    );
  }

  ok(decide("PowerShell", { command: "eas update --branch production" })?.[0] === "deny", "PowerShell was not guarded");
  ok(decide("Read", { file_path: "eas update" }) === null, "Read was routed into the eas guard");

  return done(cases.length + 2);
}

process.exit(main());
