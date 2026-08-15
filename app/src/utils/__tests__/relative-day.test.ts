import { relativeDay } from "@/utils/relative-day";

const now = new Date(2026, 7, 15, 9, 0);

describe("relativeDay", () => {
  it("calls the same calendar day today", () => {
    expect(relativeDay(new Date(2026, 7, 15, 21, 30).toISOString(), now)).toEqual({ key: "hike.today", count: 0 });
  });

  it("calls the previous calendar day yesterday, even for an evening walk", () => {
    expect(relativeDay(new Date(2026, 7, 14, 22, 0).toISOString(), now)).toEqual({ key: "hike.yesterday", count: 1 });
  });

  it("counts whole days further back", () => {
    expect(relativeDay(new Date(2026, 7, 10, 12, 0).toISOString(), now)).toEqual({ key: "hike.daysAgo", count: 5 });
  });

  it("still works across a month boundary", () => {
    expect(relativeDay(new Date(2026, 6, 31, 12, 0).toISOString(), now)).toEqual({ key: "hike.daysAgo", count: 15 });
  });

  it("gives up beyond a month so the caller falls back to a date", () => {
    expect(relativeDay(new Date(2026, 6, 1, 12, 0).toISOString(), now)).toBeNull();
  });

  it("returns null for a future date", () => {
    expect(relativeDay(new Date(2026, 7, 16, 8, 0).toISOString(), now)).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(relativeDay("not-a-date", now)).toBeNull();
  });
});
