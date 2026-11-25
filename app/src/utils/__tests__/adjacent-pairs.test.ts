// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { adjacentPairs } from "../adjacent-pairs";
import { lngLat } from "../geo/geojson";

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

it("reads a position as longitude and latitude", () => {
  expect(lngLat([12.9, 57.7, 140])).toEqual([12.9, 57.7]);
});

it("refuses a position without a latitude", () => {
  expect(() => lngLat([12.9])).toThrow("longitude and a latitude");
});
