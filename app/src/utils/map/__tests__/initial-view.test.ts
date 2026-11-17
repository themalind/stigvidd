// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SINGLE_POINT_ZOOM, initialViewFor } from "@/utils/map/initial-view";

const PADDING = { top: 10, right: 10, bottom: 10, left: 10 };

it("frames the bounds with the padding", () => {
  expect(initialViewFor([12.9, 57.7, 13.0, 57.8], PADDING)).toEqual({
    bounds: [12.9, 57.7, 13.0, 57.8],
    padding: PADDING,
  });
});

it("centres a single point at a street-level zoom, not the maximum", () => {
  expect(initialViewFor([12.9, 57.7, 12.9, 57.7], PADDING)).toEqual({
    center: [12.9, 57.7],
    zoom: SINGLE_POINT_ZOOM,
  });
});

it("leaves the camera alone without bounds", () => {
  expect(initialViewFor(null, PADDING)).toBeUndefined();
});
