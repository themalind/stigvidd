// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import Map from "@/components/map/map";
import { SCREEN_PADDING } from "@/constants/constants";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

function map() {
  return screen.getByTestId("maplibre-Map");
}

function logo() {
  return screen.getByTestId("maptiler-logo");
}

it("shows the MapTiler logo in the bottom-left corner by default", () => {
  render(<Map />);

  expect(logo()).toHaveStyle({ bottom: SCREEN_PADDING, left: SCREEN_PADDING, width: 67, height: 20 });
});

it("keeps the attribution button on, beside the logo", () => {
  render(<Map />);

  expect(map().props.attribution).toBe(true);
  expect(map().props.attributionPosition).toEqual({ bottom: SCREEN_PADDING, left: SCREEN_PADDING + 67 + 4 });
});

it("follows the caller's attribution position", () => {
  render(<Map attributionPosition={{ top: 30, left: 12 }} />);

  expect(logo()).toHaveStyle({ top: 30, left: 12 });
  expect(map().props.attributionPosition).toEqual({ top: 30, left: 12 + 67 + 4 });
});

it("moves a right-anchored attribution button inwards, away from the logo", () => {
  render(<Map attributionPosition={{ bottom: 8, right: 8 }} />);

  expect(logo()).toHaveStyle({ bottom: 8, right: 8 });
  expect(map().props.attributionPosition).toEqual({ bottom: 8, right: 8 + 67 + 4 });
});

it("gives the caller's style to the frame and fills it with the map", () => {
  const { toJSON } = render(<Map style={{ height: 180 }} />);

  expect(toJSON()).toHaveStyle({ height: 180 });
  expect(map()).toHaveStyle(StyleSheet.absoluteFill);
});
