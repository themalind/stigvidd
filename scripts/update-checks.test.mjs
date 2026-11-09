// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
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
  versionGap,
} from "./update-checks.mjs";

test("versionGap names the largest part that moved", () => {
  assert.equal(versionGap("1.2.3", "2.0.0"), "major");
  assert.equal(versionGap("1.2.3", "1.3.0"), "minor");
  assert.equal(versionGap("1.2.3", "1.2.4"), "patch");
  assert.equal(versionGap("1.2.3", "1.2.3"), "none");
});

test("versionGap treats a newer local version as not behind", () => {
  assert.equal(versionGap("2.0.0", "1.9.9"), "none");
  assert.equal(versionGap("1.3.0", "1.2.9"), "none");
});

test("versionGap says so when a version cannot be read", () => {
  assert.equal(versionGap(undefined, "1.0.0"), "unknown");
});

test("an unpinned npm package compares with latest", () => {
  const found = npmFindings("web", { typescript: { current: "5.9.3", wanted: "5.9.3", latest: "7.0.2" } });
  assert.deepEqual(found, [{ area: "web", name: "typescript", current: "5.9.3", latest: "7.0.2", gap: "major" }]);
});

test("a package Expo pins is not behind just because npm has a newer major", () => {
  const outdated = { "react-native": { current: "0.88.1", wanted: "0.88.1", latest: "0.90.0" } };
  assert.deepEqual(npmFindings("app", outdated, new Set(["react-native"])), []);
});

test("a package Expo pins counts when it drifts from its allowed range", () => {
  const outdated = { "expo-router": { current: "58.0.29", wanted: "58.0.30", latest: "59.0.0" } };
  const found = npmFindings("app", outdated, new Set(["expo-router"]));
  assert.deepEqual(found, [{ area: "app", name: "expo-router", current: "58.0.29", latest: "58.0.30", gap: "patch" }]);
});

test("npm outdated answering with an error fails instead of reading as a package", () => {
  assert.throws(() => npmFindings("web", { error: { code: "ECONNREFUSED" } }), /npm outdated failed: ECONNREFUSED/);
});

test("a package without a readable version shows up as unknown", () => {
  const found = npmFindings("web", { lost: { wanted: "1.0.0", latest: "1.0.0" } });
  const verdict = assess({ packages: found });
  assert.equal(verdict.needsAction, true);
  assert.match(formatReport(verdict, "now"), /UNKNOWN {2}web: lost has no readable version/);
});

test("npm audit reports only high and critical", () => {
  const audit = { metadata: { vulnerabilities: { low: 3, moderate: 27, high: 2, critical: 0 } } };
  assert.deepEqual(npmVulnerabilities("app", audit), [{ area: "app", name: "2 npm package(s)", severity: "high" }]);
});

test("an npm audit without a summary fails instead of reading as clean", () => {
  assert.throws(() => npmVulnerabilities("app", { error: "offline" }), /no summary/);
});

const NUGET = {
  projects: [
    {
      frameworks: [
        {
          topLevelPackages: [{ id: "MailKit", resolvedVersion: "4.18.1", latestVersion: "5.0.0" }],
          transitivePackages: [
            { id: "Deep", vulnerabilities: [{ severity: "Critical" }] },
            { id: "Mild", vulnerabilities: [{ severity: "Moderate" }] },
          ],
        },
      ],
    },
  ],
};

test("NuGet updates come from each framework's top-level packages", () => {
  assert.deepEqual(nugetFindings(NUGET), [
    { area: "backend", name: "MailKit", current: "4.18.1", latest: "5.0.0", gap: "major" },
  ]);
});

test("NuGet vulnerabilities include transitive packages and skip the mild ones", () => {
  assert.deepEqual(nugetVulnerabilities(NUGET), [{ area: "backend", name: "Deep", severity: "critical" }]);
});

test("a dotnet error fails instead of reading as clean", () => {
  const report = { problems: [{ level: "error", text: "No assets file" }] };
  assert.throws(() => nugetFindings(report), /No assets file/);
  assert.throws(() => nugetVulnerabilities({}), /no projects/);
});

test("sdkLag counts whole SDK versions", () => {
  assert.deepEqual(sdkLag("Expo", "54.0.3", "58.0.23"), { name: "Expo", current: 54, latest: 58, behind: 4 });
  assert.equal(sdkLag("Expo", "58.0.1", "58.0.23").behind, 0);
  assert.equal(sdkLag(".NET", "net10.0".replace("net", ""), "10.0").behind, 0);
});

test("sdkLag fails on a version it cannot read", () => {
  assert.throws(() => sdkLag("Expo", "", "58.0.0"), /cannot compare/);
});

test("the .NET channel skips previews and go-live", () => {
  const index = {
    "releases-index": [
      { "channel-version": "11.0", "support-phase": "go-live" },
      { "channel-version": "10.0", "support-phase": "active" },
      { "channel-version": "8.0", "support-phase": "active" },
      { "channel-version": "9.0", "support-phase": "maintenance" },
    ],
  };
  assert.equal(latestActiveDotnet(index), "10.0");
  assert.throws(() => latestActiveDotnet({}), /no active channel/);
});

test("the same package from several projects counts once", () => {
  const pkg = { area: "backend", name: "MailKit", current: "1.0.0", latest: "1.0.1", gap: "patch" };
  assert.equal(dedupe([pkg, { ...pkg }]).length, 1);
});

test("each kind of lag needs action, minor updates alone do not", () => {
  const minor = { area: "web", name: "a", current: "1.0.0", latest: "1.1.0", gap: "minor" };
  assert.equal(assess({ packages: [minor] }).needsAction, false);
  assert.equal(assess({ packages: [{ ...minor, gap: "major" }] }).needsAction, true);
  assert.equal(assess({ sdks: [{ name: "Expo", current: 57, latest: 58, behind: 1 }] }).needsAction, true);
  assert.equal(assess({ sdks: [{ name: "Expo", current: 58, latest: 58, behind: 0 }] }).needsAction, false);
  assert.equal(assess({ vulnerabilities: [{ area: "app", name: "x", severity: "high" }] }).needsAction, true);
});

test("a check that failed needs action, so it never reads as all clear", () => {
  const verdict = assess({ failures: ["web: npm outdated failed"] });
  assert.equal(verdict.needsAction, true);
  const report = formatReport(verdict, "now");
  assert.match(report, /UNKNOWN {2}web: npm outdated failed/);
  assert.doesNotMatch(report, /All SDKs/);
});

test("the report names SDKs and majors and only counts the small updates", () => {
  const report = formatReport(
    assess({
      sdks: [{ name: "Expo", current: 57, latest: 58, behind: 1 }],
      packages: [
        { area: "web", name: "typescript", current: "5.9.3", latest: "7.0.2", gap: "major" },
        { area: "web", name: "small", current: "1.0.0", latest: "1.0.1", gap: "patch" },
      ],
    }),
    "now",
  );
  assert.match(report, /SDK {6}Expo 57 -> 58 \(1 behind\)/);
  assert.match(report, /MAJOR {4}web: typescript 5\.9\.3 -> 7\.0\.2/);
  assert.match(report, /1 minor\/patch updates \(web 1\)/);
  assert.doesNotMatch(report, /small/);
});

test("the report says so when nothing is behind", () => {
  assert.match(formatReport(assess({}), "now"), /All SDKs and packages/);
});

const TS7 = { area: "web", name: "typescript", current: "6.0.3", latest: "7.0.2", gap: "major" };
const HOLD_TS7 = { area: "web", name: "typescript", major: 7, reason: "typescript-eslint" };

test("a held major is reported with its reason and needs no action", () => {
  const verdict = assess({ packages: [TS7] }, [HOLD_TS7]);
  assert.equal(verdict.needsAction, false);
  assert.deepEqual(verdict.majors, []);
  assert.match(formatReport(verdict, "now"), /HELD {5}web: typescript 6\.0\.3 -> 7\.0\.2 \(typescript-eslint\)/);
});

test("a hold covers only its own major, area and package", () => {
  assert.equal(assess({ packages: [{ ...TS7, latest: "8.0.0" }] }, [HOLD_TS7]).majors.length, 1);
  assert.equal(assess({ packages: [{ ...TS7, area: "site" }] }, [HOLD_TS7]).majors.length, 1);
  assert.equal(assess({ packages: [{ ...TS7, name: "eslint" }] }, [HOLD_TS7]).majors.length, 1);
});

test("a hold that matches nothing needs action, so it gets removed", () => {
  const verdict = assess({}, [HOLD_TS7]);
  assert.equal(verdict.needsAction, true);
  assert.match(formatReport(verdict, "now"), /UNKNOWN {2}web: the hold on typescript 7 matches nothing/);
});

test("a hold without a reason is refused", () => {
  assert.deepEqual(parseHolds(JSON.stringify([HOLD_TS7])), [HOLD_TS7]);
  assert.throws(() => parseHolds(JSON.stringify([{ ...HOLD_TS7, reason: " " }])), /needs area, name, major and a reason/);
  assert.throws(() => parseHolds(JSON.stringify([{ ...HOLD_TS7, major: "7" }])), /needs area/);
  assert.throws(() => parseHolds("{}"), /must be a list/);
});

test("the committed holds file parses", () => {
  const file = new URL("./update-holds.json", import.meta.url);
  assert.ok(parseHolds(readFileSync(file, "utf8")).length > 0);
});

test("a cached result is fresh only within its age", () => {
  const now = Date.parse("2026-11-09T12:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  assert.equal(cacheIsFresh("2026-11-09T01:00:00Z", now, day), true);
  assert.equal(cacheIsFresh("2026-11-08T11:00:00Z", now, day), false);
  assert.equal(cacheIsFresh("not a date", now, day), false);
});
