// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { adjacentPairs } from "./adjacent-pairs";

describe("adjacentPairs", () => {
  it("pairs each item with the next", () => {
    expect(adjacentPairs(["a", "b", "c"])).toEqual([
      ["a", "b"],
      ["b", "c"],
    ]);
  });

  it("has no pairs for fewer than two items", () => {
    expect(adjacentPairs([])).toEqual([]);
    expect(adjacentPairs([1])).toEqual([]);
  });

  it("keeps a falsy item", () => {
    expect(adjacentPairs([0, 0])).toEqual([[0, 0]]);
  });
});
