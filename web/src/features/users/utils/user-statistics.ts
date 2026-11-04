// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AuthorStatisticResponse, ReporterStatisticResponse } from "@/api/generated/model";

// keep-comment: pending reports are not evidence, so nothing decided means no accuracy, not 0 %
export function reporterAccuracy({
  dismissed,
  upheld,
}: Pick<ReporterStatisticResponse, "dismissed" | "upheld">): number | null {
  const decided = dismissed + upheld;

  if (decided === 0) return null;

  return Math.round((upheld / decided) * 100);
}

export type StrikeSeverity = "none" | "watch" | "serious";

export function strikeSeverity(strikes: number): StrikeSeverity {
  if (strikes <= 0) return "none";
  if (strikes >= 3) return "serious";

  return "watch";
}

export function withheldNote(reporter: Pick<ReporterStatisticResponse, "reportsAreWithheld">): string | null {
  return reporter.reportsAreWithheld
    ? "Too many of this account's reports were dismissed, so their reports no longer hide anything."
    : null;
}

export function emptyExplanation(tab: "reporters" | "authors"): string {
  return tab === "reporters"
    ? "Nobody has reported anything yet."
    : "Nobody has had content upheld against them. Strikes appear here only after a report is upheld.";
}

export function withheldReporters(reporters: ReporterStatisticResponse[]): ReporterStatisticResponse[] {
  return reporters.filter((reporter) => reporter.reportsAreWithheld);
}

export function totalStrikes(authors: Pick<AuthorStatisticResponse, "strikes">[]): number {
  return authors.reduce((sum, author) => sum + author.strikes, 0);
}
