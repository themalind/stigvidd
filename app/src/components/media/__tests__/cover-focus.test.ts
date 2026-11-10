// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { coverOverflow, focusAfterDrag } from "@/components/media/cover-focus";

describe("coverOverflow", () => {
  it("is the shown height past a 2:1 frame for a portrait image", () => {
    expect(coverOverflow(300, { width: 3000, height: 4000 }, 2)).toBe(250);
  });

  it("is nothing for an image as wide as the frame or wider", () => {
    expect(coverOverflow(300, { width: 2000, height: 1000 }, 2)).toBe(0);
    expect(coverOverflow(300, { width: 4000, height: 1000 }, 2)).toBe(0);
  });

  it("is nothing before the frame or the image has a size", () => {
    expect(coverOverflow(0, { width: 3000, height: 4000 }, 2)).toBe(0);
    expect(coverOverflow(300, { width: 0, height: 4000 }, 2)).toBe(0);
  });
});

describe("focusAfterDrag", () => {
  it("moves towards the top when the finger moves down", () => {
    expect(focusAfterDrag(0.5, 50, 250)).toBeCloseTo(0.3);
  });

  it("moves towards the bottom when the finger moves up", () => {
    expect(focusAfterDrag(0.5, -50, 250)).toBeCloseTo(0.7);
  });

  it("stops at the image's edges", () => {
    expect(focusAfterDrag(0.5, 1000, 250)).toBe(0);
    expect(focusAfterDrag(0.5, -1000, 250)).toBe(1);
  });

  it("keeps the focus when there is nothing to drag", () => {
    expect(focusAfterDrag(0.4, 80, 0)).toBe(0.4);
  });
});
