// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { avatarColors, initials } from "../avatar-color";

const hueOf = (color: string) => color.match(/^hsl\((\d+),/)?.[1];

describe("avatarColors", () => {
  it("gives a person the same colour every time", () => {
    expect(avatarColors("user-123", false)).toEqual(avatarColors("user-123", false));
  });

  // keep-comment: pins the hash, since changing it would recolour every user at once
  it("keeps today's colour for a known seed", () => {
    expect(hueOf(avatarColors("user-123", false).background)).toBe("350");
    expect(hueOf(avatarColors("anna", false).background)).toBe("15");
  });

  it("spreads different people over several colours", () => {
    const hues = new Set(Array.from({ length: 50 }, (_, i) => hueOf(avatarColors(`user-${i}`, false).background)));
    expect(hues.size).toBeGreaterThanOrEqual(6);
  });

  it("keeps the hue but changes the shades in dark mode", () => {
    const light = avatarColors("user-123", false);
    const dark = avatarColors("user-123", true);

    expect(hueOf(dark.background)).toBe(hueOf(light.background));
    expect(dark.background).not.toBe(light.background);
    expect(dark.foreground).not.toBe(light.foreground);
  });
});

describe("initials", () => {
  it("takes the first two letters in capitals", () => {
    expect(initials("skogsmus")).toBe("SK");
  });

  it("ignores leading spaces", () => {
    expect(initials("  bo")).toBe("BO");
  });

  it("copes with a one-letter name", () => {
    expect(initials("å")).toBe("Å");
  });
});
