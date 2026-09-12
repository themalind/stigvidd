// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  canDecide,
  didNotHide,
  dismissEnabled,
  hideOutcomeExplanation,
  narrowedBy,
  reporterRisk,
  strikeAfterUphold,
  upholdEnabled,
  type DecidableReport,
} from "./moderation-review";

function report(overrides: Partial<DecidableReport> = {}): DecidableReport {
  return { status: "Pending", contentStillExists: true, ...overrides };
}

describe("canDecide", () => {
  it("allows a pending report", () => {
    expect(canDecide(report())).toBe(true);
  });

  // The content went before anyone decided, but the strike still has to be able to land.
  it("allows a report whose content expired", () => {
    expect(canDecide(report({ status: "ContentExpired", contentStillExists: false }))).toBe(true);
  });

  it.each(["Dismissed", "Upheld"] as const)("refuses a report already %s", (status) => {
    expect(canDecide(report({ status }))).toBe(false);
  });

  it("refuses when nothing is selected", () => {
    expect(canDecide(null)).toBe(false);
  });
});

describe("upholdEnabled", () => {
  // Upholding deletes the row permanently, so it stays off until the content was opened.
  it("is off until the moderator has read the content", () => {
    expect(upholdEnabled(report(), false)).toBe(false);
    expect(upholdEnabled(report(), true)).toBe(true);
  });

  it("stays off on a report that is already decided, read or not", () => {
    expect(upholdEnabled(report({ status: "Upheld" }), true)).toBe(false);
  });
});

describe("dismissEnabled", () => {
  // Dismiss is reversible, so it needs no read gate.
  it("is on for a pending report without reading anything", () => {
    expect(dismissEnabled(report())).toBe(true);
  });

  // There is nothing left to put back.
  it("is off once the content has expired", () => {
    expect(dismissEnabled(report({ status: "ContentExpired", contentStillExists: false }))).toBe(
      false,
    );
  });
});

describe("hideOutcomeExplanation", () => {
  it("says nothing for a report that did hide the content", () => {
    expect(hideOutcomeExplanation("Hidden")).toBeNull();
    expect(didNotHide("Hidden")).toBe(false);
  });

  // Two rows with the same status but different effects in the app look like a bug unless
  // the queue explains which is which.
  it.each(["AlreadyHidden", "WithheldReporterDismissed"])("explains %s", (outcome) => {
    expect(hideOutcomeExplanation(outcome)).toBeTruthy();
    expect(didNotHide(outcome)).toBe(true);
  });
});

describe("reporterRisk", () => {
  it("knows nothing about a reporter with no history", () => {
    expect(reporterRisk({ reporterTotal: 0, reporterDismissed: 0 })).toBe("unknown");
    expect(reporterRisk(null)).toBe("unknown");
  });

  it("calls a reporter clean when nothing of theirs was dismissed", () => {
    expect(reporterRisk({ reporterTotal: 4, reporterDismissed: 0 })).toBe("clean");
  });

  it("flags one dismissal as worth watching", () => {
    expect(reporterRisk({ reporterTotal: 4, reporterDismissed: 1 })).toBe("watch");
  });

  // Three is the same threshold the backend withholds hiding at.
  it("calls three dismissals unreliable", () => {
    expect(reporterRisk({ reporterTotal: 9, reporterDismissed: 3 })).toBe("unreliable");
  });
});

describe("narrowedBy", () => {
  it("lists nothing when no filter is set", () => {
    expect(narrowedBy({})).toEqual([]);
  });

  it("names each filter that is narrowing the list", () => {
    expect(narrowedBy({ status: "Pending", hideOutcome: "Hidden" })).toEqual([
      "status Pending",
      "outcome Hidden",
    ]);
  });
});

describe("strikeAfterUphold", () => {
  // Strikes count distinct content, so upholding a second report on the same content adds
  // nothing. The dialog must not promise a number the backend will not produce.
  it("adds one for content that has not been upheld before", () => {
    expect(strikeAfterUphold(2, false)).toBe(3);
  });

  it("adds nothing when this content is already counted", () => {
    expect(strikeAfterUphold(2, true)).toBe(2);
  });
});
