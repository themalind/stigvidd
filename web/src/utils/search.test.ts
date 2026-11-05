// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { matchesAll, searchTerms } from "./search";

describe("matchesAll", () => {
  it("finds words in any order and across punctuation", () => {
    expect(matchesAll("Kråkstigen – Kråkered", searchTerms("Kråkered Kråkstigen"))).toBe(true);
  });

  it("ignores case and accents", () => {
    expect(matchesAll("Öresjö runt", searchTerms("ORESJO"))).toBe(true);
  });

  it("needs every word", () => {
    expect(matchesAll("Kråkstigen", searchTerms("kråkstigen rya"))).toBe(false);
  });

  it("has no terms for a blank query", () => {
    expect(searchTerms("   ")).toEqual([]);
  });
});
