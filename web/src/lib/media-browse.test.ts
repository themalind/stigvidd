// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { MediaItemResponse } from "@/api/generated/model";
import {
  canSelectAllMatching,
  describeMediaFilters,
  emptyMediaFilters,
  isFiltered,
  pageSelection,
  selectableMedia,
  toMediaFilter,
  toMediaQuery,
  togglePageSelection,
  wouldBeChangedBy,
  type MediaFilterState,
} from "./media-browse";
import { NEEDS_WORK_PRESET, presetByKey } from "./media-reprocess";

function filters(patch: Partial<MediaFilterState> = {}): MediaFilterState {
  return { ...emptyMediaFilters, ...patch };
}

function item(patch: Partial<MediaItemResponse> = {}): MediaItemResponse {
  return {
    identifier: "media-1",
    imageUrl: "https://example.test/a.jpg",
    ownerType: "Trail",
    ownerName: "Tiveden",
    format: "jpeg",
    width: 1600,
    height: 1200,
    sizeBytes: 2048,
    ...patch,
  } as MediaItemResponse;
}

describe("toMediaQuery", () => {
  it("sends nothing at all for the empty filter", () => {
    expect(toMediaQuery(filters())).toEqual({});
  });

  it("drops an empty numeric field rather than sending zero", () => {
    expect(toMediaQuery(filters({ minWidth: "" }))).not.toHaveProperty("MinWidth");
  });

  it("drops a non-numeric field rather than sending NaN", () => {
    expect(toMediaQuery(filters({ minWidth: "abc" }))).not.toHaveProperty("MinWidth");
  });

  it("turns All into an absent filter", () => {
    const query = toMediaQuery(filters({ ownerType: "All", format: "All" }));
    expect(query).not.toHaveProperty("OwnerType");
    expect(query).not.toHaveProperty("Format");
  });

  it("converts kilobytes to bytes", () => {
    expect(toMediaQuery(filters({ minSizeKb: "500" })).MinSizeBytes).toBe(512000);
  });

  it("sends the day after the chosen end date, because the bound is exclusive", () => {
    const query = toMediaQuery(filters({ uploadedTo: "2026-03-12" }));
    const sent = query.CreatedTo;
    if (!sent) throw new Error("expected CreatedTo to be sent");

    expect(new Date(sent).getDate()).toBe(13);
  });

  it("takes the needs-work bounds from the preset rather than a literal", () => {
    const preset = presetByKey(NEEDS_WORK_PRESET);
    const query = toMediaQuery(filters({ needsWork: true }), preset);

    expect(query.TargetMaxWidth).toBe(Number(preset.resolution));
    expect(query.TargetFormat).toBe(preset.format);
  });
});

describe("toMediaFilter", () => {
  it("restates the query in the body's camelCase spelling", () => {
    const body = toMediaFilter(filters({ needsWork: true, ownerType: "Trail" }));
    const preset = presetByKey(NEEDS_WORK_PRESET);

    expect(body.ownerType).toBe("Trail");
    expect(body.targetMaxWidth).toBe(Number(preset.resolution));
    expect(body.targetFormat).toBe(preset.format);
  });
});

describe("describeMediaFilters", () => {
  it("is empty when nothing is set", () => {
    expect(describeMediaFilters(filters())).toEqual([]);
    expect(isFiltered(filters())).toBe(false);
  });

  it("names every active filter", () => {
    const active = filters({
      needsWork: true,
      ownerType: "Trail",
      format: "webp",
      minWidth: "800",
      maxWidth: "4000",
      minHeight: "600",
      maxHeight: "3000",
      minSizeKb: "50",
      maxSizeKb: "900",
      uploadedFrom: "2026-01-01",
      uploadedTo: "2026-03-12",
    });

    expect(describeMediaFilters(active)).toHaveLength(11);
    expect(isFiltered(active)).toBe(true);
  });
});

describe("wouldBeChangedBy", () => {
  const preset = presetByKey(NEEDS_WORK_PRESET);

  it("marks an oversize image", () => {
    expect(wouldBeChangedBy(item({ width: 3024, height: 4032 }), preset)).toBe(true);
  });

  it("marks an image that is only too tall", () => {
    expect(wouldBeChangedBy(item({ width: 400, height: 4000, format: "webp" }), preset)).toBe(true);
  });

  it("marks a small image of the wrong format", () => {
    expect(wouldBeChangedBy(item({ width: 100, height: 100, format: "jpeg" }), preset)).toBe(true);
  });

  it("leaves an image already within the preset alone", () => {
    expect(wouldBeChangedBy(item({ width: 800, height: 600, format: "webp" }), preset)).toBe(false);
  });

  it("marks an image whose dimensions are unknown", () => {
    expect(wouldBeChangedBy(item({ width: 0, height: 0, format: "webp" }), preset)).toBe(true);
  });
});

describe("selection", () => {
  const trail = item({ identifier: "trail-1" });
  const facility = item({ identifier: "facility-1", ownerType: "Facility" });
  const symbol = item({ identifier: "symbol-1", ownerType: "TrailSymbol" });
  const page = [trail, facility, symbol];

  it("never offers a trail symbol", () => {
    expect(selectableMedia(page).map((i) => i.identifier)).toEqual(["trail-1", "facility-1"]);
  });

  it("reaches whole on a page that contains a symbol", () => {
    const selected = new Set(["trail-1", "facility-1"]);
    expect(pageSelection(selected, page)).toEqual({ onPage: 2, whole: true });
  });

  it("reports nothing before the first load", () => {
    expect(pageSelection(new Set(), null)).toEqual({ onPage: 0, whole: false });
  });

  it("leaves another page's selection alone when this page is ticked", () => {
    const next = togglePageSelection(new Set(["other-page-1"]), page);
    expect([...next].sort()).toEqual(["facility-1", "other-page-1", "trail-1"]);
  });

  it("clears only this page when it was already whole", () => {
    const next = togglePageSelection(new Set(["trail-1", "facility-1", "other-page-1"]), page);
    expect([...next]).toEqual(["other-page-1"]);
  });

  it("offers select-all-matching only once the page is whole and more match", () => {
    const whole = { onPage: 2, whole: true };
    const partial = { onPage: 1, whole: false };
    const selected = new Set(["trail-1", "facility-1"]);

    expect(canSelectAllMatching(whole, 1204, selected, false)).toBe(true);
    expect(canSelectAllMatching(partial, 1204, selected, false)).toBe(false);
    expect(canSelectAllMatching(whole, 2, selected, false)).toBe(false);
    expect(canSelectAllMatching(whole, 1204, selected, true)).toBe(false);
  });
});
