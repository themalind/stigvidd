// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules the moderation queue runs on, kept out of the page so they can be tested
// without a browser. Everything here is pure.
//
// These are the guard rails between a moderator and an irreversible write: upholding
// hard-deletes the content, and the strike it records is what a decision to remove an
// account is built on.
import type { ContentReportSummaryResponse } from "@/api/generated/model";

export type ReportStatus = "Pending" | "Dismissed" | "Upheld" | "ContentExpired";
export type HideOutcome = "Hidden" | "AlreadyHidden" | "WithheldReporterDismissed";

/** What a decision needs from a report; the page hands it the whole row. */
export type DecidableReport = Pick<ContentReportSummaryResponse, "status" | "contentStillExists">;

/**
 * A report can be decided while it is Pending, and one more time after the content expired
 * — because upholding then still records the strike, which is the whole reason expiry does
 * not simply close the case.
 */
export function canDecide(report: DecidableReport | null): boolean {
  if (!report) return false;

  return report.status === "Pending" || report.status === "ContentExpired";
}

/**
 * Uphold stays off until the moderator has actually opened the content, because it deletes
 * the row and there is no undo. Dismiss has no such gate: it is reversible.
 */
export function upholdEnabled(report: DecidableReport | null, hasReadContent: boolean): boolean {
  return canDecide(report) && hasReadContent;
}

/** Dismissing content that is already gone changes nothing, so the button goes too. */
export function dismissEnabled(report: DecidableReport | null): boolean {
  return canDecide(report) && report?.status !== "ContentExpired";
}

/**
 * Why a report did not hide anything. Two rows with the same status but different effects
 * in the app look like a bug unless the queue says which is which.
 */
export function hideOutcomeExplanation(hideOutcome: string): string | null {
  switch (hideOutcome) {
    case "AlreadyHidden":
      return "Someone else had already reported this, so it was hidden before this report arrived.";
    case "WithheldReporterDismissed":
      return "This reporter has had too many reports dismissed, so this one did not hide the content.";
    default:
      return null;
  }
}

/** True when the row should carry the "did not hide" marker. */
export function didNotHide(hideOutcome: string): boolean {
  return hideOutcomeExplanation(hideOutcome) !== null;
}

export type ReporterCounts = {
  reporterTotal: number;
  reporterDismissed: number;
};

export type ReporterRisk = "unknown" | "clean" | "watch" | "unreliable";

/**
 * How much weight to give this reporter, from their own record. Only a rough steer for the
 * moderator: the backend, not this, is what decides whether a report still hides anything.
 */
export function reporterRisk(counts: ReporterCounts | null): ReporterRisk {
  if (!counts || counts.reporterTotal === 0) return "unknown";
  if (counts.reporterDismissed === 0) return "clean";
  if (counts.reporterDismissed >= 3) return "unreliable";

  return "watch";
}

/**
 * Which filters are narrowing the queue, so an empty list can explain itself instead of
 * reading as "nothing was ever reported".
 */
export function narrowedBy(filters: {
  status?: string;
  contentType?: string;
  hideOutcome?: string;
}): string[] {
  return [
    filters.status ? `status ${filters.status}` : null,
    filters.contentType ? `type ${filters.contentType}` : null,
    filters.hideOutcome ? `outcome ${filters.hideOutcome}` : null,
  ].filter((entry): entry is string => entry !== null);
}

/**
 * What the confirmation dialog says the strike count will become. Counted on content, not
 * on reports, so three people reporting the same review still adds one.
 */
export function strikeAfterUphold(currentStrikes: number, alreadyUpheld: boolean): number {
  return alreadyUpheld ? currentStrikes : currentStrikes + 1;
}
