// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { Session } from "@/api/trail-import";
import type { AdminTrailListItem } from "@/types/types";
import { importsAwaitingReview, relativeTime, share, trailStats } from "./dashboard";

function trail(overrides: Partial<AdminTrailListItem>): AdminTrailListItem {
  return {
    identifier: "id",
    name: "Name",
    trailLength: 5,
    accessibility: false,
    classification: 1,
    city: "Borås",
    isVerified: true,
    hasImages: true,
    hasExampleImages: false,
    hasSymbol: true,
    hasDescription: true,
    hasFullDescription: true,
    createdAt: "2026-01-01T00:00:00Z",
    lastUpdatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function session(status: string): Session {
  return { id: 1, identifier: "s", source: "boras", fileName: "f.geojson", fileHash: "h", status };
}

describe("trailStats", () => {
  it("counts what needs attention", () => {
    const stats = trailStats([
      trail({}),
      trail({ isVerified: false, hasExampleImages: true }),
      trail({ hasImages: false, hasDescription: false }),
      trail({ hasExampleImages: true }),
    ]);

    expect(stats).toEqual({
      total: 4,
      inactive: 1,
      withExampleImages: 2,
      withoutImages: 1,
      withoutDescription: 1,
    });
  });

  it("is all zeroes for no trails", () => {
    expect(trailStats([])).toEqual({
      total: 0,
      inactive: 0,
      withExampleImages: 0,
      withoutImages: 0,
      withoutDescription: 0,
    });
  });
});

describe("importsAwaitingReview", () => {
  it("counts only sessions waiting for a decision", () => {
    expect(
      importsAwaitingReview([
        session("AwaitingReview"),
        session("Applied"),
        session("AwaitingReview"),
        session("Failed"),
      ]),
    ).toBe(2);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-04T12:00:00Z");

  it("says how long ago, in the largest unit that fits", () => {
    expect(relativeTime("2026-10-04T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-10-04T11:45:00Z", now)).toBe("15 minutes ago");
    expect(relativeTime("2026-10-04T09:00:00Z", now)).toBe("3 hours ago");
    expect(relativeTime("2026-10-03T12:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2026-09-20T12:00:00Z", now)).toBe("2 weeks ago");
  });
});

describe("share", () => {
  it("is a rounded percentage, and zero of nothing", () => {
    expect(share(2, 3)).toBe(67);
    expect(share(0, 0)).toBe(0);
  });
});
