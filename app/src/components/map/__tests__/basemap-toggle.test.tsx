// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { basemapAtom, loadBasemap } from "@/atoms/basemap-atom";
import BasemapToggle from "@/components/map/basemap-toggle";
import Map from "@/components/map/map";
import { getMapStyle } from "@/components/map/map-style";
import { renderWithProviders } from "@/test/render";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, screen } from "@testing-library/react-native";
import React from "react";

beforeEach(async () => {
  await AsyncStorage.clear();
});

function show(initial: "outdoor" | "satellite" = "outdoor") {
  renderWithProviders(
    <>
      <Map />
      <BasemapToggle />
    </>,
    { initialAtoms: [[basemapAtom, initial]] },
  );
}

function mapStyle() {
  return screen.getByTestId("maplibre-Map").props.mapStyle;
}

it("offers satellite while the outdoor map shows", () => {
  show();

  expect(mapStyle()).toBe(getMapStyle("outdoor"));
  expect(screen.getByLabelText("Visa satellitkarta")).toBeTruthy();
});

it("switches the map to satellite and remembers it", async () => {
  show();

  await act(async () => {
    fireEvent.press(screen.getByTestId("basemap-toggle"));
  });

  expect(mapStyle()).toBe(getMapStyle("satellite"));
  expect(screen.getByLabelText("Visa terrängkarta")).toBeTruthy();
  expect(await loadBasemap()).toBe("satellite");
});

it("switches back to the outdoor map", async () => {
  show("satellite");

  await act(async () => {
    fireEvent.press(screen.getByTestId("basemap-toggle"));
  });

  expect(mapStyle()).toBe(getMapStyle("outdoor"));
  expect(await loadBasemap()).toBe("outdoor");
});

it("uses MapTiler's hybrid style for satellite", () => {
  expect(getMapStyle("satellite")).toContain("/maps/hybrid-v4/style.json");
  expect(getMapStyle("outdoor")).not.toBe(getMapStyle("satellite"));
});

// A style that was never loaded cannot be fetched offline, and the map would go blank. keep-comment: why offline is blocked
it("keeps the current map while offline", async () => {
  onlineManager.setOnline(false);
  try {
    show();

    await act(async () => {
      fireEvent.press(screen.getByTestId("basemap-toggle"));
    });

    expect(mapStyle()).toBe(getMapStyle("outdoor"));
    expect(screen.getByTestId("basemap-toggle")).toBeDisabled();
    expect(await loadBasemap()).toBe("outdoor");
  } finally {
    onlineManager.setOnline(true);
  }
});
