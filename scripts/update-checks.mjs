// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind check-updates.mjs: pure functions over what npm, dotnet and the release feeds answer.

const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

function parts(version) {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(version));
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
}

export function versionGap(current, latest) {
  const a = parts(current);
  const b = parts(latest);
  if (!a || !b) return "unknown";
  if (b[0] !== a[0]) return b[0] > a[0] ? "major" : "none";
  if (b[1] !== a[1]) return b[1] > a[1] ? "minor" : "none";
  return b[2] > a[2] ? "patch" : "none";
}

// A package Expo pins moves with the SDK, so only drift from its allowed range counts. keep-comment: npm's latest is a false alarm for these
export function npmFindings(area, outdated, pinned = new Set()) {
  if (outdated.error) throw new Error(`npm outdated failed: ${outdated.error.code ?? outdated.error.summary}`);
  return Object.entries(outdated).flatMap(([name, info]) => {
    const target = pinned.has(name) ? info.wanted : info.latest;
    const gap = versionGap(info.current, target);
    return gap === "none" ? [] : [{ area, name, current: info.current ?? "missing", latest: target, gap }];
  });
}

export function npmVulnerabilities(area, audit) {
  const counts = audit?.metadata?.vulnerabilities;
  if (!counts) throw new Error(`${area}: npm audit gave no summary`);
  return [...BLOCKING_SEVERITIES].flatMap((severity) =>
    counts[severity] > 0 ? [{ area, name: `${counts[severity]} npm package(s)`, severity }] : [],
  );
}

function dotnetProjects(report) {
  const problems = report?.problems?.filter((problem) => problem.level === "error") ?? [];
  if (problems.length > 0 || !Array.isArray(report?.projects)) {
    throw new Error(problems[0]?.text ?? "dotnet list gave no projects");
  }
  return report.projects.flatMap((project) => project.frameworks ?? []);
}

export function nugetFindings(report) {
  return dotnetProjects(report).flatMap((framework) =>
    (framework.topLevelPackages ?? []).flatMap((pkg) => {
      const gap = versionGap(pkg.resolvedVersion, pkg.latestVersion);
      return gap === "none"
        ? []
        : [{ area: "backend", name: pkg.id, current: pkg.resolvedVersion, latest: pkg.latestVersion, gap }];
    }),
  );
}

export function nugetVulnerabilities(report) {
  return dotnetProjects(report).flatMap((framework) =>
    [...(framework.topLevelPackages ?? []), ...(framework.transitivePackages ?? [])].flatMap((pkg) =>
      (pkg.vulnerabilities ?? [])
        .filter((vulnerability) => BLOCKING_SEVERITIES.has(vulnerability.severity.toLowerCase()))
        .map((vulnerability) => ({
          area: "backend",
          name: pkg.id,
          severity: vulnerability.severity.toLowerCase(),
        })),
    ),
  );
}

export function sdkLag(name, current, latest) {
  const a = parts(current);
  const b = parts(latest);
  if (!a || !b) throw new Error(`${name}: cannot compare "${current}" with "${latest}"`);
  return { name, current: a[0], latest: b[0], behind: Math.max(0, b[0] - a[0]) };
}

// Only "active" counts: a preview or go-live channel is not a release yet. keep-comment: the feed lists those first
export function latestActiveDotnet(index) {
  const channels = (index?.["releases-index"] ?? [])
    .filter((release) => release["support-phase"] === "active")
    .map((release) => release["channel-version"]);
  if (channels.length === 0) throw new Error("the .NET release feed lists no active channel");
  return channels.sort((a, b) => parts(b)[0] - parts(a)[0])[0];
}

export function dedupe(findings) {
  const seen = new Map();
  for (const finding of findings) {
    seen.set(`${finding.area}|${finding.name}|${finding.current ?? finding.severity}`, finding);
  }
  return [...seen.values()];
}

export function assess({ sdks = [], packages = [], vulnerabilities = [], failures = [] }) {
  const behindSdks = sdks.filter((sdk) => sdk.behind > 0);
  const majors = packages.filter((pkg) => pkg.gap === "major");
  const smaller = packages.filter((pkg) => pkg.gap === "minor" || pkg.gap === "patch");
  const unreadable = packages
    .filter((pkg) => pkg.gap === "unknown")
    .map((pkg) => `${pkg.area}: ${pkg.name} has no readable version (${pkg.current} -> ${pkg.latest})`);
  const allFailures = [...failures, ...unreadable];
  return {
    behindSdks,
    majors,
    smaller,
    vulnerabilities,
    failures: allFailures,
    needsAction: behindSdks.length > 0 || majors.length > 0 || vulnerabilities.length > 0 || allFailures.length > 0,
  };
}

export function formatReport(verdict, checkedAt) {
  const lines = [`Dependency check (${checkedAt})`];
  for (const sdk of verdict.behindSdks) {
    lines.push(`  SDK      ${sdk.name} ${sdk.current} -> ${sdk.latest} (${sdk.behind} behind)`);
  }
  for (const vulnerability of verdict.vulnerabilities) {
    lines.push(`  VULN     ${vulnerability.area}: ${vulnerability.name} (${vulnerability.severity})`);
  }
  for (const pkg of verdict.majors) {
    lines.push(`  MAJOR    ${pkg.area}: ${pkg.name} ${pkg.current} -> ${pkg.latest}`);
  }
  if (verdict.smaller.length > 0) {
    const perArea = {};
    for (const pkg of verdict.smaller) perArea[pkg.area] = (perArea[pkg.area] ?? 0) + 1;
    const summary = Object.entries(perArea)
      .map(([area, count]) => `${area} ${count}`)
      .join(", ");
    lines.push(`  minor    ${verdict.smaller.length} minor/patch updates (${summary})`);
  }
  for (const failure of verdict.failures) lines.push(`  UNKNOWN  ${failure}`);
  if (lines.length === 1) lines.push("  All SDKs and packages are on the latest version.");
  return lines.join("\n");
}

export function cacheIsFresh(checkedAt, now, maxAgeMs) {
  const age = now - Date.parse(checkedAt);
  return age >= 0 && age < maxAgeMs;
}
