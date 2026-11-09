#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reports how far every area is behind on SDKs and packages. It changes nothing.
//
//   node scripts/check-updates.mjs             full report
//   node scripts/check-updates.mjs --verbose   also lists each minor and patch update
//   node scripts/check-updates.mjs --strict    exits 1 when something needs action (majors in update-holds.json excepted)
//   node scripts/check-updates.mjs --pre-push  for .githooks/pre-push: checks at most daily, never fails
import { exec } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  assess,
  cacheIsFresh,
  dedupe,
  formatReport,
  latestActiveDotnet,
  npmFindings,
  npmVulnerabilities,
  nugetFindings,
  nugetVulnerabilities,
  parseHolds,
  sdkLag,
} from "./update-checks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NODE_AREAS = ["app", "web", "site"];
const DOTNET_RELEASES = "https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json";
const DAY_MS = 24 * 60 * 60 * 1000;
const run = promisify(exec);

// npm outdated and audit exit 1 when they find something, so their stdout is read either way. keep-comment: non-zero is their normal answer
async function output(command, cwd = ROOT) {
  try {
    const { stdout } = await run(command, { cwd, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  } catch (error) {
    if (error.stdout) return error.stdout;
    throw new Error(`${command}: ${String(error.stderr || error.message).trim().split("\n")[0]}`);
  }
}

async function json(command, cwd) {
  return JSON.parse(await output(command, cwd));
}

function expoPinned() {
  const file = path.join(ROOT, "app", "node_modules", "expo", "bundledNativeModules.json");
  if (!existsSync(file)) throw new Error("app: expo is not installed, run npm ci");
  return new Set(["expo", ...Object.keys(JSON.parse(readFileSync(file, "utf8")))]);
}

async function checkNodeArea(area, pinned) {
  const cwd = path.join(ROOT, area);
  const [outdated, audit] = await Promise.all([json("npm outdated --json", cwd), json("npm audit --json", cwd)]);
  return { packages: npmFindings(area, outdated, pinned), vulnerabilities: npmVulnerabilities(area, audit) };
}

async function checkProject(project) {
  const [outdated, vulnerable] = await Promise.all([
    json(`dotnet list "${project}" package --outdated --format json`),
    json(`dotnet list "${project}" package --vulnerable --include-transitive --format json`),
  ]);
  return { packages: nugetFindings(outdated), vulnerabilities: nugetVulnerabilities(vulnerable) };
}

async function checkExpo() {
  const installed = JSON.parse(readFileSync(path.join(ROOT, "app", "node_modules", "expo", "package.json"), "utf8"));
  return { sdks: [sdkLag("Expo", installed.version, (await output("npm view expo version")).trim())] };
}

async function checkDotnet() {
  const csproj = readFileSync(path.join(ROOT, "backend", "StigviddAPI", "StigviddAPI.csproj"), "utf8");
  const target = /<TargetFramework>net([\d.]+)<\/TargetFramework>/.exec(csproj)?.[1];
  const response = await fetch(DOTNET_RELEASES);
  if (!response.ok) throw new Error(`the .NET release feed answered ${response.status}`);
  return { sdks: [sdkLag(".NET", target, latestActiveDotnet(await response.json()))] };
}

async function fullCheck() {
  const projects = (await output("git ls-files *.csproj")).split("\n").map((line) => line.trim()).filter(Boolean);
  let pinned = new Set();
  const failures = [];
  try {
    pinned = expoPinned();
  } catch (error) {
    failures.push(error.message);
  }

  const checks = [
    ["Expo", checkExpo()],
    [".NET", checkDotnet()],
    ...NODE_AREAS.map((area) => [area, checkNodeArea(area, area === "app" ? pinned : undefined)]),
    ...projects.map((project) => [path.basename(project), checkProject(project)]),
  ];
  const settled = await Promise.allSettled(checks.map(([, check]) => check));

  const merged = { sdks: [], packages: [], vulnerabilities: [], failures };
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      merged.failures.push(`${checks[index][0]}: ${result.reason.message}`);
      return;
    }
    merged.sdks.push(...(result.value.sdks ?? []));
    merged.packages.push(...(result.value.packages ?? []));
    merged.vulnerabilities.push(...(result.value.vulnerabilities ?? []));
  });
  merged.packages = dedupe(merged.packages);
  merged.vulnerabilities = dedupe(merged.vulnerabilities);
  return merged;
}

async function cachePath() {
  return path.resolve(ROOT, (await output("git rev-parse --git-path stigvidd-update-check.json")).trim());
}

async function prePush() {
  const file = await cachePath();
  const cached = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  if (cached && cacheIsFresh(cached.checkedAt, Date.now(), DAY_MS)) {
    print(cached.result, cached.checkedAt, false);
    return;
  }
  process.stdout.write("Checking SDKs and packages (at most once a day)...\n");
  const result = await fullCheck();
  const checkedAt = new Date().toISOString();
  // A failed check is not cached, so the next push tries again. keep-comment: offline must not hide lag for a day
  if (result.failures.length === 0) writeFileSync(file, JSON.stringify({ checkedAt, result }));
  print(result, checkedAt, false);
}

function print(result, checkedAt, verbose) {
  const verdict = assess(result, parseHolds(readFileSync(path.join(ROOT, "scripts", "update-holds.json"), "utf8")));
  process.stdout.write(formatReport(verdict, checkedAt) + "\n");
  if (verbose) {
    for (const pkg of verdict.smaller) {
      process.stdout.write(`  ${pkg.gap.padEnd(8)} ${pkg.area}: ${pkg.name} ${pkg.current} -> ${pkg.latest}\n`);
    }
  }
  return verdict;
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  if (flags.has("--pre-push")) {
    await prePush().catch((error) => process.stdout.write(`Dependency check skipped: ${error.message}\n`));
    return 0;
  }
  const verdict = print(await fullCheck(), new Date().toISOString(), flags.has("--verbose"));
  return flags.has("--strict") && verdict.needsAction ? 1 : 0;
}

process.exit(await main());
