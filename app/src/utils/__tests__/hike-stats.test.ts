// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Hike } from "@/data/types";
import { formatTotalDuration, latestHike, summarizeHikes } from "@/utils/hike-stats";

function hike(overrides: Partial<Hike>): Hike {
  return {
    identifier: "id",
    name: "Promenad",
    hikeLength: 0,
    duration: 0,
    createdBy: "user",
    createdAt: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

describe("summarizeHikes", () => {
  it("returns zeroes for an empty list", () => {
    expect(summarizeHikes([])).toEqual({ count: 0, totalKm: 0, totalMs: 0 });
  });

  it("sums length and duration across hikes", () => {
    const stats = summarizeHikes([
      hike({ hikeLength: 4.2, duration: 3600000 }),
      hike({ hikeLength: 2.8, duration: 1800000 }),
    ]);

    expect(stats.count).toBe(2);
    expect(stats.totalKm).toBeCloseTo(7);
    expect(stats.totalMs).toBe(5400000);
  });

  it("skips non-finite values but still counts the hike", () => {
    const stats = summarizeHikes([hike({ hikeLength: NaN, duration: 60000 }), hike({ hikeLength: 3, duration: NaN })]);

    expect(stats.count).toBe(2);
    expect(stats.totalKm).toBe(3);
    expect(stats.totalMs).toBe(60000);
  });
});

describe("latestHike", () => {
  it("returns undefined for an empty list", () => {
    expect(latestHike([])).toBeUndefined();
  });

  it("picks the most recent regardless of list order", () => {
    const newest = hike({ identifier: "newest", createdAt: "2026-08-14T08:00:00Z" });

    const result = latestHike([
      hike({ identifier: "older", createdAt: "2026-07-01T08:00:00Z" }),
      newest,
      hike({ identifier: "oldest", createdAt: "2026-01-01T08:00:00Z" }),
    ]);

    expect(result?.identifier).toBe("newest");
  });

  it("ignores hikes with an unparseable date", () => {
    const result = latestHike([hike({ identifier: "broken", createdAt: "not-a-date" }), hike({ identifier: "good" })]);

    expect(result?.identifier).toBe("good");
  });
});

describe("formatTotalDuration", () => {
  it("shows minutes below an hour", () => {
    expect(formatTotalDuration(45 * 60000)).toBe("45 min");
    expect(formatTotalDuration(0)).toBe("0 min");
  });

  it("never reports a negative total", () => {
    expect(formatTotalDuration(-1000)).toBe("0 min");
  });

  it("keeps one decimal while the total is small", () => {
    expect(formatTotalDuration(90 * 60000)).toBe("1,5 h");
  });

  it("drops the decimal once it stops telling the reader anything", () => {
    expect(formatTotalDuration(14 * 3600000)).toBe("14 h");
    expect(formatTotalDuration(47.4 * 3600000)).toBe("47 h");
  });
});
