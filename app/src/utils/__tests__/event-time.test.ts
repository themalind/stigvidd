// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { dateBadgeParts, formatClock, formatEventDate, formatPostTime, formatTimeRange } from "@/utils/event-time";

const START = new Date(2026, 10, 7, 9, 30).toISOString();
const END = new Date(2026, 10, 7, 12, 0).toISOString();
const NEXT_DAY = new Date(2026, 10, 8, 12, 0).toISOString();

describe("event times in Swedish", () => {
  it("splits the date badge into weekday, day and month without trailing dots", () => {
    expect(dateBadgeParts(START, "sv")).toEqual({ weekday: "lör", day: "7", month: "nov" });
  });

  it("formats the clock, the range and the long date", () => {
    expect(formatClock(START, "sv")).toBe("09:30");
    expect(formatTimeRange(START, END, "sv")).toBe("09:30–12:00");
    expect(formatTimeRange(START, NEXT_DAY, "sv")).toBe("09:30");
    expect(formatEventDate(START, "sv")).toBe("lördag 7 november");
    expect(formatPostTime(START, "sv")).toBe("7 nov 09:30");
  });
});

describe("formatter reuse", () => {
  it("builds one formatter per language and kind, however many dates it formats", () => {
    const spy = jest.spyOn(Intl, "DateTimeFormat");
    try {
      for (let i = 0; i < 10; i++) formatClock(START, "en-GB");
      expect(spy).toHaveBeenCalledTimes(1);

      formatClock(START, "de");
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });
});
