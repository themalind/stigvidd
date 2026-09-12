// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The arithmetic behind the two statistics tabs, kept out of the page so it can be tested
// without a browser. Everything here is pure.
//
// Both tabs feed the same decision: whether an account should be removed. A number that is
// wrong here is a number someone is removed on.
import type { AuthorStatistic, ReporterStatistic } from "@/api/content-reports";

/**
 * A reporter whose account is gone has no nickname left, and neither does an author whose
 * snapshot was cleared by the deletion step. Saying so is better than an empty cell that
 * reads as a rendering fault.
 */
export function displayName(nickName: string | null | undefined): string {
  return nickName?.trim() ? nickName : "Account deleted";
}

export type ReporterCounts = Pick<
  ReporterStatistic,
  "total" | "pending" | "dismissed" | "upheld"
>;

/**
 * How often this reporter turned out to be right, counted over decided reports only.
 * Pending ones are not evidence either way, so a reporter with nothing decided yet has no
 * accuracy rather than an accuracy of zero.
 */
export function reporterAccuracy(counts: ReporterCounts): number | null {
  const decided = (counts.dismissed ?? 0) + (counts.upheld ?? 0);

  if (decided === 0) return null;

  return Math.round(((counts.upheld ?? 0) / decided) * 100);
}

export type StrikeSeverity = "none" | "watch" | "serious";

/** Three upheld pieces of content is the point at which the list is worth acting on. */
export function strikeSeverity(strikes: number | undefined): StrikeSeverity {
  if (!strikes || strikes <= 0) return "none";
  if (strikes >= 3) return "serious";

  return "watch";
}

/**
 * Why a reporter's rows can climb while nothing gets hidden. Without this the tab looks
 * like the hiding rule is broken.
 */
export function withheldNote(reporter: Pick<ReporterStatistic, "reportsAreWithheld">): string | null {
  return reporter.reportsAreWithheld
    ? "Too many of this account's reports were dismissed, so their reports no longer hide anything."
    : null;
}

/** An empty tab has to say which of the two it is: nothing reported, or nothing upheld. */
export function emptyExplanation(tab: "reporters" | "authors"): string {
  return tab === "reporters"
    ? "Nobody has reported anything yet."
    : "Nobody has had content upheld against them. Strikes appear here only after a report is upheld.";
}

/**
 * The reporters the moderator should look at first: their reports no longer hide anything,
 * which is a state the queue itself never shows.
 */
export function withheldReporters(reporters: ReporterStatistic[]): ReporterStatistic[] {
  return reporters.filter((reporter) => reporter.reportsAreWithheld === true);
}

/** Total strikes on the page, for the caption that says what the list adds up to. */
export function totalStrikes(authors: AuthorStatistic[]): number {
  return authors.reduce((sum, author) => sum + (author.strikes ?? 0), 0);
}
