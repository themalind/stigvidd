// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import MapFilterMenu from "@/components/map/map-filter-menu";
import { MARKER_COLORS } from "@/components/map/marker-styles";
import { SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { MapMarkerFilter } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const onChange = jest.fn();

const NOTHING_ON: MapMarkerFilter = { trails: false, shelters: false, firePits: false, accessibility: false };
const ALL_ON: MapMarkerFilter = { trails: true, shelters: true, firePits: true, accessibility: true };

function show(
  filter: Partial<MapMarkerFilter> = {},
  theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme,
) {
  return renderWithProviders(<MapFilterMenu filter={{ ...NOTHING_ON, ...filter }} onChange={onChange} />, { theme });
}

function open() {
  fireEvent.press(screen.getByTestId("map-filter-trigger"));
}

beforeEach(() => {
  jest.clearAllMocks();
});

// The map is the point; the menu is a pill until it is asked for.
it("starts collapsed, showing only the pill", () => {
  show();

  expect(screen.getByText("Filter")).toBeTruthy();
  expect(screen.queryByTestId("map-filter-panel")).toBeNull();
  expect(screen.queryByText("Leder")).toBeNull();
});

it("opens on the pill and lists every category", () => {
  show();

  open();

  expect(screen.getByText("Leder")).toBeTruthy();
  expect(screen.getByText("Vindskydd")).toBeTruthy();
  expect(screen.getByText("Grillplatser")).toBeTruthy();
  expect(screen.getByText("Tillgänglighet")).toBeTruthy();
});

it("closes again on a second press", () => {
  show();

  open();
  open();

  expect(screen.queryByTestId("map-filter-panel")).toBeNull();
});

it("turns the chevron over while it is open", () => {
  show();

  expect(screen.getByTestId("icon-keyboard-arrow-down")).toBeTruthy();

  open();

  expect(screen.getByTestId("icon-keyboard-arrow-up")).toBeTruthy();
  expect(screen.queryByTestId("icon-keyboard-arrow-down")).toBeNull();
});

// The badge is how a closed menu says the map is showing less than everything.
it("counts the filters that are on", () => {
  show({ trails: true, shelters: true });

  expect(screen.getByText("2")).toBeTruthy();
});

it("counts all four", () => {
  show(ALL_ON);

  expect(screen.getByText("4")).toBeTruthy();
});

it("shows no badge when nothing is filtered on", () => {
  show(NOTHING_ON);

  expect(screen.queryByText("0")).toBeNull();
});

it("turns on the category that was pressed, and leaves the others alone", () => {
  show({ shelters: true });

  open();
  fireEvent.press(screen.getByTestId("map-filter-row-trails"));

  expect(onChange).toHaveBeenCalledWith({ trails: true, shelters: true, firePits: false, accessibility: false });
});

it("turns off a category that is already on", () => {
  show(ALL_ON);

  open();
  fireEvent.press(screen.getByTestId("map-filter-row-firePits"));

  expect(onChange).toHaveBeenCalledWith({ trails: true, shelters: true, firePits: false, accessibility: true });
});

// Accessibility filters every category rather than being one of its own.
it("treats accessibility as a filter like any other to toggle", () => {
  show();

  open();
  fireEvent.press(screen.getByTestId("map-filter-row-accessibility"));

  expect(onChange).toHaveBeenCalledWith({ ...NOTHING_ON, accessibility: true });
});

it("ticks the boxes of the categories that are on", () => {
  show({ trails: true, firePits: true });

  open();

  expect(screen.getAllByTestId("icon-check-box")).toHaveLength(2);
  expect(screen.getAllByTestId("icon-check-box-outline-blank")).toHaveLength(2);
});

// The swatch is a legend: it has to be the colour that category's pin is drawn in.
it("draws each category's swatch in that category's marker colour", () => {
  show();

  open();

  expect(screen.getByTestId("map-filter-dot-trails")).toHaveStyle({
    backgroundColor: MARKER_COLORS.trails.fill,
    borderColor: MARKER_COLORS.trails.stroke,
  });
  expect(screen.getByTestId("map-filter-dot-shelters")).toHaveStyle({
    backgroundColor: MARKER_COLORS.shelters.fill,
  });
  expect(screen.getByTestId("map-filter-dot-firePits")).toHaveStyle({
    backgroundColor: MARKER_COLORS.firePits.fill,
  });
});

// Accessibility has no pin on the map, so it gets its own icon instead of a swatch.
it("gives accessibility an icon rather than a colour swatch", () => {
  show();

  open();

  expect(screen.queryByTestId("map-filter-dot-accessibility")).toBeNull();
  expect(screen.getByTestId("icon-wheelchair-accessibility")).toBeTruthy();
});

it("keeps the swatches the same in dark mode, since the basemap stays light", () => {
  show({}, AppDarkTheme);

  open();

  expect(screen.getByTestId("map-filter-dot-trails")).toHaveStyle({ backgroundColor: MARKER_COLORS.trails.fill });
});

it("dims the label of a category that is switched off", () => {
  show({ trails: true });

  open();

  expect(screen.getByText("Leder")).toHaveStyle({ color: AppDefaultTheme.colors.onSurface });
  expect(screen.getByText("Vindskydd")).toHaveStyle({ color: AppDefaultTheme.colors.onSurfaceVariant });
});

it("draws a ticked box in the accent colour and an empty one in the outline colour", () => {
  show({ trails: true });

  open();

  expect(screen.getByTestId("icon-check-box").props.color).toBe(AppDefaultTheme.colors.primary);
  expect(screen.getAllByTestId("icon-check-box-outline-blank")[0].props.color).toBe(
    AppDefaultTheme.colors.outlineVariant,
  );
});

// Depth comes from elevation colour rather than a shadow, so the level matters.
it("lifts pill and panel onto the theme's second elevation level", () => {
  show();

  open();

  expect(screen.getByTestId("map-filter-trigger")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.elevation.level2,
  });
  expect(screen.getByTestId("map-filter-panel")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.elevation.level2,
    borderRadius: SURFACE_BORDER_RADIUS,
    minWidth: 210,
  });
});

it("lifts them onto the dark theme's second elevation level too", () => {
  show({}, AppDarkTheme);

  open();

  expect(screen.getByTestId("map-filter-panel")).toHaveStyle({
    backgroundColor: AppDarkTheme.colors.elevation.level2,
  });
});
