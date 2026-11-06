#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Publishes an OTA update only after checking the git state, the EAS variables and the built bundle.
// Usage: npm run publish:production -- --message "Text" [--dry-run] [--yes]

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { ENVIRONMENTS, checkBundle, checkVariables, parseDotenv, parseEnvList } from "./publish-checks.mjs";

const APP_DIR = fileURLToPath(new URL("..", import.meta.url));
const IS_WINDOWS = process.platform === "win32";

function fail(message, details = []) {
  console.error(`\n✖ ${message}`);
  for (const line of details) console.error(`  - ${line}`);
  console.error("\nNothing was published.");
  process.exit(1);
}

function quote(arg) {
  return /[\s"&|<>^()]/.test(arg) ? `"${arg}"` : arg;
}

// eas is a .cmd shim on Windows, which Node only spawns through a shell.
function run(command, args, { env = process.env, capture = true } = {}) {
  const result = spawnSync(IS_WINDOWS ? `${command} ${args.map(quote).join(" ")}` : command, IS_WINDOWS ? [] : args, {
    cwd: APP_DIR,
    env,
    shell: IS_WINDOWS,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail(`${command} ${args[0]} failed (exit ${result.status})`, capture ? [result.stderr.trim()] : []);
  }
  return result.stdout ?? "";
}

function parseArgs(argv) {
  const [environment, ...rest] = argv;
  const options = { environment, message: "", dryRun: false, yes: false };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--message" || rest[i] === "-m") options.message = rest[++i] ?? "";
    else if (rest[i] === "--dry-run") options.dryRun = true;
    else if (rest[i] === "--yes") options.yes = true;
    else fail(`Unknown argument "${rest[i]}"`);
  }
  if (!ENVIRONMENTS[options.environment])
    fail(`First argument must be one of: ${Object.keys(ENVIRONMENTS).join(", ")}`);
  if (!options.dryRun && !options.message.trim()) fail("--message is required");
  if (options.message.includes('"')) fail("--message may not contain double quotes");
  return options;
}

function checkGit(environment, dryRun) {
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const commit = run("git", ["rev-parse", "--short", "HEAD"]).trim();
  const errors = [];

  if (run("git", ["status", "--porcelain", "--", "."]).trim()) {
    errors.push("app/ has uncommitted changes; the update must be built from a commit");
  }
  const wanted = ENVIRONMENTS[environment].gitBranch;
  if (wanted) {
    if (branch !== wanted) errors.push(`on branch "${branch}", but ${environment} is published from "${wanted}"`);
    run("git", ["fetch", "--quiet", "origin", wanted]);
    const remote = run("git", ["rev-parse", "--short", `origin/${wanted}`]).trim();
    if (remote !== commit) errors.push(`HEAD ${commit} is not origin/${wanted} (${remote}); pull or push first`);
  }
  // A dry run reports git problems but carries on, so the other checks still run.
  if (errors.length && !dryRun) fail("Git check failed", errors);
  for (const line of errors) console.warn(`  ! ${line}`);
  return { branch, commit };
}

function readVariables(environment) {
  const listed = parseEnvList(run("eas", ["env:list", "--environment", environment, "--format", "long"]));
  const dir = mkdtempSync(join(tmpdir(), "stigvidd-env-"));
  const file = join(dir, ".env");
  try {
    run("eas", ["env:pull", "--environment", environment, "--path", file, "--non-interactive"]);
    return { listed, pulled: parseDotenv(readFileSync(file, "utf8")) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Only the pulled variables reach the bundle: inherited EXPO_PUBLIC_* and app/.env are shut out.
function exportBundle(pulled) {
  const outDir = mkdtempSync(join(tmpdir(), "stigvidd-publish-"));
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("EXPO_PUBLIC_")));
  Object.assign(env, pulled, { EXPO_NO_DOTENV: "1", NODE_ENV: "production" });
  run(
    "node",
    [
      join(APP_DIR, "node_modules", "expo", "bin", "cli"),
      "export",
      "--platform",
      "ios",
      "--platform",
      "android",
      "--output-dir",
      outDir,
      "--dump-assetmap",
      "--dump-sourcemap",
      "--clear",
    ],
    { env, capture: false },
  );
  return outDir;
}

function readBundles(outDir) {
  const root = join(outDir, "_expo", "static", "js");
  const bundles = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(hbc|js)$/.test(name))
        bundles.push({ file: relative(outDir, path), content: readFileSync(path, "latin1") });
    }
  };
  walk(root);
  return bundles;
}

async function confirm(environment) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nType "${environment}" to publish: `);
  rl.close();
  if (answer.trim() !== environment) fail("Not confirmed");
}

const options = parseArgs(process.argv.slice(2));
const { environment } = options;

console.log(`→ Git (${environment})`);
const { branch, commit } = checkGit(environment, options.dryRun);

console.log("→ EAS variables");
const { listed, pulled } = readVariables(environment);
const variableErrors = checkVariables(environment, listed, pulled);
if (variableErrors.length) fail(`EAS environment "${environment}" is wrong`, variableErrors);

console.log("→ Bundle");
const outDir = exportBundle(pulled);
const bundles = readBundles(outDir);
const bundleErrors = checkBundle(environment, bundles);
if (bundleErrors.length) fail("The built bundle points at the wrong environment", bundleErrors);

console.log(`\n✔ ${environment}: branch ${branch} @ ${commit}`);
console.log(`  API ${pulled.EXPO_PUBLIC_API_URL}, realm ${pulled.EXPO_PUBLIC_OIDC_REALM}`);
console.log(`  ${bundles.length} bundle(s) checked in ${outDir}`);

if (options.dryRun) {
  console.log("\nDry run: nothing was published.");
  process.exit(0);
}
if (!options.yes) await confirm(environment);

run(
  "eas",
  [
    "update",
    "--branch",
    environment,
    "--environment",
    environment,
    "--message",
    options.message,
    "--skip-bundler",
    "--input-dir",
    outDir,
    "--non-interactive",
  ],
  { capture: false },
);
rmSync(outDir, { recursive: true, force: true });
