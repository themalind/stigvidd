// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { AuthorStatistic, ReporterStatistic } from "@/api/content-reports";
import {
  displayName,
  emptyExplanation,
  reporterAccuracy,
  strikeSeverity,
  totalStrikes,
  withheldNote,
  withheldReporters,
} from "./moderation-statistics";

function reporter(overrides: Partial<ReporterStatistic> = {}): ReporterStatistic {
  return {
    nickName: "VandrarVennen",
    total: 4,
    pending: 1,
    dismissed: 1,
    upheld: 2,
    lastReportedAt: "2026-05-04T10:00:00Z",
    reportsAreWithheld: false,
    ...overrides,
  };
}

describe("displayName", () => {
  it("uses the nickname when there is one", () => {
    expect(displayName("SkogsGreven")).toBe("SkogsGreven");
  });

  // A deleted account leaves neither a user row nor a snapshot, and an empty cell reads as
  // a rendering fault rather than as the fact it is.
  it.each([null, undefined, "", "   "])("says the account is gone for %p", (value) => {
    expect(displayName(value)).toBe("Account deleted");
  });
});

describe("reporterAccuracy", () => {
  it("counts upheld against decided reports", () => {
    expect(reporterAccuracy({ total: 4, pending: 1, dismissed: 1, upheld: 2 })).toBe(67);
  });

  // Pending reports are not evidence either way. Counting them as wrong would make every
  // new reporter look unreliable the moment they report something.
  it("ignores pending reports", () => {
    expect(reporterAccuracy({ total: 9, pending: 7, dismissed: 0, upheld: 2 })).toBe(100);
  });

  it("has no accuracy at all when nothing has been decided", () => {
    expect(reporterAccuracy({ total: 3, pending: 3, dismissed: 0, upheld: 0 })).toBeNull();
  });

  it("reports zero for a reporter who was always wrong", () => {
    expect(reporterAccuracy({ total: 2, pending: 0, dismissed: 2, upheld: 0 })).toBe(0);
  });
});

describe("strikeSeverity", () => {
  it.each([
    [0, "none"],
    [1, "watch"],
    [2, "watch"],
    [3, "serious"],
    [12, "serious"],
  ] as const)("calls %i strikes %s", (strikes, expected) => {
    expect(strikeSeverity(strikes)).toBe(expected);
  });

  it("treats a missing count as none", () => {
    expect(strikeSeverity(undefined)).toBe("none");
  });
});

describe("withheldNote", () => {
  // Rows climbing while nothing gets hidden looks like a broken hiding rule unless the tab
  // says why.
  it("explains a reporter whose reports no longer hide", () => {
    expect(withheldNote({ reportsAreWithheld: true })).toContain("no longer hide");
  });

  it("says nothing about an ordinary reporter", () => {
    expect(withheldNote({ reportsAreWithheld: false })).toBeNull();
  });
});

describe("withheldReporters", () => {
  it("picks out only the withheld ones", () => {
    const rows = [
      reporter({ nickName: "A" }),
      reporter({ nickName: "B", reportsAreWithheld: true }),
      reporter({ nickName: "C", reportsAreWithheld: true }),
    ];

    expect(withheldReporters(rows).map((r) => r.nickName)).toEqual(["B", "C"]);
  });

  it("returns nothing when every reporter still hides", () => {
    expect(withheldReporters([reporter(), reporter()])).toEqual([]);
  });
});

describe("totalStrikes", () => {
  it("adds the page up", () => {
    const authors: AuthorStatistic[] = [{ strikes: 3 }, { strikes: 1 }, { strikes: 2 }];

    expect(totalStrikes(authors)).toBe(6);
  });

  it("survives a row with no count", () => {
    expect(totalStrikes([{ nickName: "A" }, { strikes: 2 }])).toBe(2);
  });
});

describe("emptyExplanation", () => {
  // Two different empty states: nothing reported at all, or reports that never led to a
  // strike. They mean opposite things about the moderation backlog.
  it("distinguishes the two empty tabs", () => {
    expect(emptyExplanation("reporters")).not.toBe(emptyExplanation("authors"));
    expect(emptyExplanation("authors")).toContain("upheld");
  });
});
