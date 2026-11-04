// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { MediaReprocessItemResponse } from "@/api/generated/model";
import { groupFailures } from "./media-reprocess-failures";

const item = (mediaIdentifier: string, status: string, lastError?: string | null): MediaReprocessItemResponse => ({
  identifier: `item-${mediaIdentifier}`,
  mediaIdentifier,
  ownerType: "Trail",
  status,
  lastError,
});

describe("groupFailures", () => {
  it("collapses identical reasons into one group, largest first", () => {
    const groups = groupFailures([
      item("b", "Failed", "Decode: bad header"),
      item("a", "Failed", "Download: 404 Not Found"),
      item("c", "Failed", "Download: 404 Not Found"),
    ]);

    expect(groups).toEqual([
      { reason: "Download: 404 Not Found", mediaIdentifiers: ["a", "c"] },
      { reason: "Decode: bad header", mediaIdentifiers: ["b"] },
    ]);
  });

  it("ignores items that did not fail", () => {
    const groups = groupFailures([
      item("a", "Succeeded"),
      item("b", "Pending"),
      item("c", "Cancelled"),
      item("d", "Failed", "Upload: 500"),
    ]);

    expect(groups).toEqual([{ reason: "Upload: 500", mediaIdentifiers: ["d"] }]);
  });

  it("gives a failure without a recorded error a reason of its own", () => {
    const groups = groupFailures([item("a", "Failed", null), item("b", "Failed", "  ")]);

    expect(groups).toEqual([{ reason: "No reason recorded", mediaIdentifiers: ["a", "b"] }]);
  });
});
