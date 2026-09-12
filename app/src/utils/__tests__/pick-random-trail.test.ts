// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { pickRandomTrail } from "@/utils/pick-random-trail";

const TRAILS = [{ identifier: "a" }, { identifier: "b" }, { identifier: "c" }];

describe("pickRandomTrail", () => {
  it("returns null for an empty list", () => {
    expect(pickRandomTrail([], undefined, () => 0)).toBeNull();
  });

  it("maps the random value onto the index", () => {
    expect(pickRandomTrail(TRAILS, undefined, () => 0)?.identifier).toBe("a");
    expect(pickRandomTrail(TRAILS, undefined, () => 0.5)?.identifier).toBe("b");
    expect(pickRandomTrail(TRAILS, undefined, () => 0.9)?.identifier).toBe("c");
  });

  it("stays inside the array for the largest value below 1", () => {
    expect(pickRandomTrail(TRAILS, undefined, () => 0.9999999999999999)?.identifier).toBe("c");
  });

  it("stays inside the array for a source that returns 1", () => {
    // Math.random() never returns 1, but the injected source is part of the signature.
    expect(pickRandomTrail(TRAILS, undefined, () => 1)?.identifier).toBe("c");
  });

  it("never returns the excluded trail", () => {
    // Every index of the three-trail list, drawn while excluding the middle one.
    for (const value of [0, 0.34, 0.5, 0.67, 0.99]) {
      expect(pickRandomTrail(TRAILS, "b", () => value)?.identifier).not.toBe("b");
    }
  });

  it("still draws from the remaining trails after an exclusion", () => {
    expect(pickRandomTrail(TRAILS, "b", () => 0)?.identifier).toBe("a");
    expect(pickRandomTrail(TRAILS, "b", () => 0.9)?.identifier).toBe("c");
  });

  it("returns the only trail even when it is the excluded one", () => {
    expect(pickRandomTrail([{ identifier: "a" }], "a", () => 0)?.identifier).toBe("a");
  });

  it("defaults to Math.random", () => {
    const spy = jest.spyOn(Math, "random").mockReturnValue(0.5);
    try {
      expect(pickRandomTrail(TRAILS)?.identifier).toBe("b");
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
