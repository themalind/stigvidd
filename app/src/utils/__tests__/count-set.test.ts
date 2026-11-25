// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { countSet } from "../count-set";

describe("countSet", () => {
  it("counts the keys that hold a value", () => {
    expect(countSet({ city: "Borås", classification: 2 })).toBe(2);
  });

  it("skips a key a cleared filter left as undefined", () => {
    const filters: { city?: string; classification?: number } = { city: undefined, classification: 2 };

    expect(countSet(filters)).toBe(1);
  });

  it("counts a falsy value that is still set", () => {
    expect(countSet({ accessibility: false, minRating: 0 })).toBe(2);
  });
});
