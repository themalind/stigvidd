// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  canCancel,
  canRetry,
  describeNextAttempt,
  describePurge,
  isValidPurgeCutoff,
  statusTone,
} from "./mail-outbox";

describe("canRetry", () => {
  // Failed is the obvious one; Cancelled matters because an operator changing their mind is
  // the same transition, and the API accepts it.
  it.each(["Failed", "Cancelled"])("allows a settled, unsent mail (%s)", (status) => {
    expect(canRetry({ status })).toBe(true);
  });

  // The one that matters. The dispatcher holds a Sending row right now; requeueing it would
  // let it be claimed twice and the mail delivered twice.
  it("refuses a mail that is being sent right now", () => {
    expect(canRetry({ status: "Sending" })).toBe(false);
  });

  it.each(["Pending", "Sent"])("refuses %s", (status) => {
    expect(canRetry({ status })).toBe(false);
  });
});

describe("canCancel", () => {
  it("allows a mail that has not been claimed yet", () => {
    expect(canCancel({ status: "Pending" })).toBe(true);
  });

  // Cancelling cannot un-send, so offering it would be a lie.
  it.each(["Sending", "Sent", "Failed", "Cancelled"])("refuses %s", (status) => {
    expect(canCancel({ status })).toBe(false);
  });
});

describe("statusTone", () => {
  it("reads Sent as done and Failed as wrong", () => {
    expect(statusTone("Sent")).toBe("ok");
    expect(statusTone("Failed")).toBe("bad");
  });

  it("falls through to a visible tone for a status it does not know", () => {
    // A status added on the backend must not silently render as nothing.
    expect(statusTone("SomethingNew")).toBe("warn");
  });
});

describe("describeNextAttempt", () => {
  const now = new Date("2026-09-18T12:00:00Z");

  it("says nothing for a mail that is not waiting", () => {
    expect(describeNextAttempt({ status: "Sent" }, now)).toBe("");
  });

  it("counts the failures behind a queued retry", () => {
    // A Pending row with attempts is not a contradiction — it is what a retried mail looks
    // like — and the page has to say so or it reads as a bug.
    const text = describeNextAttempt(
      { status: "Pending", nextAttemptAt: "2026-09-18T11:59:00Z", attempts: 2 },
      now,
    );

    expect(text).toContain("2 failed so far");
  });

  it("reports the remaining backoff when the mail is not due yet", () => {
    const text = describeNextAttempt(
      { status: "Pending", nextAttemptAt: "2026-09-18T12:08:00Z", attempts: 3 },
      now,
    );

    expect(text).toContain("8 minutes");
  });

  it("survives a missing or unparseable timestamp", () => {
    expect(describeNextAttempt({ status: "Pending" }, now)).toBe("Waiting to be sent.");
    expect(describeNextAttempt({ status: "Pending", nextAttemptAt: "nonsense" }, now)).toBe(
      "Waiting to be sent.",
    );
  });
});

describe("describePurge", () => {
  it("names what is spared, not just what is deleted", () => {
    // The question an operator actually has at this dialog is whether it will lose their
    // failed mail — the diagnostic record they are most likely to still need.
    const text = describePurge(30, 12);

    expect(text).toContain("30 days");
    expect(text).toContain("failed");
    expect(text).toContain("never touched");
  });

  it("agrees with itself about singulars", () => {
    expect(describePurge(1, 1)).toContain("1 day");
    expect(describePurge(1, 1)).toContain("is 1 sent mail");
  });
});

describe("isValidPurgeCutoff", () => {
  // Zero is what an empty input coerces to, and on the backend it would mean "everything".
  it("refuses zero, negatives and fractions", () => {
    expect(isValidPurgeCutoff(0)).toBe(false);
    expect(isValidPurgeCutoff(-1)).toBe(false);
    expect(isValidPurgeCutoff(1.5)).toBe(false);
  });

  it("accepts the range the API accepts", () => {
    expect(isValidPurgeCutoff(1)).toBe(true);
    expect(isValidPurgeCutoff(3650)).toBe(true);
    expect(isValidPurgeCutoff(3651)).toBe(false);
  });
});
