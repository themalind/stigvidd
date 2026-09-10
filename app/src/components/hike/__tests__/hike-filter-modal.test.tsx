// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { HikeFilterModal } from "@/components/hike/hike-filter-modal";
import { BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { HikeFilterOptions, HikeFilterRanges } from "@/hooks/hike/useHikeFilters";
import { renderWithProviders } from "@/test/render";
import { Slider as RangeSlider } from "@miblanchard/react-native-slider";
import { act, fireEvent, screen } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";

const onClose = jest.fn();
const onUpdateFilter = jest.fn();
const onUpdateRangeFilter = jest.fn();
const onClearFilters = jest.fn();

// The sharer select is a native wheel on iOS, whose options no query reaches, and plain rows on
// Android; driving it means being Android. See select-input.test.tsx.
beforeAll(() => {
  Platform.OS = "android";
});

afterAll(() => {
  Platform.OS = "ios";
});

// Deliberately different maxima: they are what tells the two sliders apart below.
const RANGES: HikeFilterRanges = { lengthMax: 20, lengthStep: 1, durationMax: 180, durationStep: 5 };

function show(
  props: {
    filters?: HikeFilterOptions;
    sharedByNames?: string[];
    ranges?: HikeFilterRanges;
    visible?: boolean;
  } = {},
  theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme,
) {
  return renderWithProviders(
    <HikeFilterModal
      visible={props.visible ?? true}
      onClose={onClose}
      filters={props.filters ?? {}}
      sharedByNames={props.sharedByNames ?? []}
      ranges={props.ranges ?? RANGES}
      onUpdateFilter={onUpdateFilter}
      onUpdateRangeFilter={onUpdateRangeFilter}
      onClearFilters={onClearFilters}
    />,
    { theme },
  );
}

// Neither slider takes a testID, so each is identified by the range it covers: kilometres, or minutes.
function slider(maximumValue: number) {
  return screen.UNSAFE_getAllByType(RangeSlider as never).find((node) => node.props.maximumValue === maximumValue)!;
}

const lengthSlider = () => slider(RANGES.lengthMax);
const durationSlider = () => slider(RANGES.durationMax);

beforeEach(() => {
  jest.clearAllMocks();
});

it("stays out of the way until it is opened", () => {
  show({ visible: false });

  expect(screen.queryByText("Filter & Sortering")).toBeNull();
});

it("offers a way out and a way to start over", () => {
  show();

  expect(screen.getByText("Filter & Sortering")).toBeTruthy();
  expect(screen.getByText("Rensa")).toBeTruthy();
  expect(screen.getByText("Klar")).toBeTruthy();
});

it("closes on Klar without touching the filters", () => {
  show();

  fireEvent.press(screen.getByTestId("hike-filter-done"));

  expect(onClose).toHaveBeenCalled();
  expect(onUpdateFilter).not.toHaveBeenCalled();
  expect(onClearFilters).not.toHaveBeenCalled();
});

// Clearing leaves the sheet open: the point is to see the unfiltered list build up again.
it("clears the filters without closing", () => {
  show();

  fireEvent.press(screen.getByTestId("hike-filter-clear"));

  expect(onClearFilters).toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it("offers to filter by sharer once someone has shared a hike", () => {
  show({ sharedByNames: ["Alva", "Bo"] });

  expect(screen.getByText("Delad av")).toBeTruthy();
});

// Your own hikes have no sharer, so the section would be an empty control.
it("hides the sharer filter when nobody has shared anything", () => {
  show({ sharedByNames: [] });

  expect(screen.queryByText("Delad av")).toBeNull();
});

it("filters on the sharer that was picked", () => {
  show({ sharedByNames: ["Alva", "Bo"] });

  fireEvent.press(screen.getByText("Alla"));
  fireEvent.press(screen.getByText("Bo"));

  expect(onUpdateFilter).toHaveBeenCalledWith("sharedBy", "Bo");
});

// "Alla" is the absence of a filter, not a sharer named "".
it("turns 'all sharers' back into no filter at all", () => {
  show({ sharedByNames: ["Alva"], filters: { sharedBy: "Alva" } });

  fireEvent.press(screen.getByText("Alva"));
  fireEvent.press(screen.getByText("Alla"));

  expect(onUpdateFilter).toHaveBeenCalledWith("sharedBy", undefined);
});

it("opens each range on the whole span it could cover", () => {
  show();

  expect(lengthSlider().props.value).toEqual([0, RANGES.lengthMax]);
  expect(lengthSlider().props.step).toBe(RANGES.lengthStep);
  expect(durationSlider().props.value).toEqual([0, RANGES.durationMax]);
  expect(durationSlider().props.step).toBe(RANGES.durationStep);
});

it("puts the sliders where the filters already are", () => {
  show({ filters: { minLength: 3, maxLength: 8, minDuration: 30, maxDuration: 90 } });

  expect(lengthSlider().props.value).toEqual([3, 8]);
  expect(durationSlider().props.value).toEqual([30, 90]);
});

it("says which span each slider is currently on", () => {
  show({ filters: { minLength: 3, maxLength: 8, minDuration: 30, maxDuration: 90 } });

  expect(screen.getByText("Längd: 3 - 8 km")).toBeTruthy();
  expect(screen.getByText("Tid: 30 - 90 min")).toBeTruthy();
});

// With no filter set the heading has to name the range on offer, not "0 - undefined".
it("falls back to the full range in the headings", () => {
  show();

  expect(screen.getByText("Längd: 0 - 20 km")).toBeTruthy();
  expect(screen.getByText("Tid: 0 - 180 min")).toBeTruthy();
});

it("reports a moved length slider as a length filter", () => {
  show();

  act(() => lengthSlider().props.onValueChange([4, 11]));

  expect(onUpdateRangeFilter).toHaveBeenCalledWith("length", 4, 11);
});

it("reports a moved duration slider as a duration filter", () => {
  show();

  act(() => durationSlider().props.onValueChange([15, 60]));

  expect(onUpdateRangeFilter).toHaveBeenCalledWith("duration", 15, 60);
});

it("keeps the two ranges apart", () => {
  show();

  act(() => lengthSlider().props.onValueChange([4, 11]));

  expect(onUpdateRangeFilter).toHaveBeenCalledTimes(1);
  expect(onUpdateRangeFilter).not.toHaveBeenCalledWith("duration", expect.anything(), expect.anything());
});

it("fills the screen on the theme's background", () => {
  show();

  expect(screen.getByTestId("hike-filter-sheet")).toHaveStyle({
    flex: 1,
    backgroundColor: AppDefaultTheme.colors.background,
  });
});

it("fills the screen on the dark theme's background too", () => {
  show({}, AppDarkTheme);

  expect(screen.getByTestId("hike-filter-sheet")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.background });
});

// The two header buttons carry the accent colours, so their labels take the matching on-colour.
it("draws the header buttons on their own accent colours", () => {
  show();

  expect(screen.getByText("Rensa")).toHaveStyle({ color: AppDefaultTheme.colors.onSecondary });
  expect(screen.getByTestId("hike-filter-clear")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.secondary,
    borderRadius: BORDER_RADIUS,
  });
  expect(screen.getByText("Klar")).toHaveStyle({ color: AppDefaultTheme.colors.onPrimary });
  expect(screen.getByTestId("hike-filter-done")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.primary,
    borderRadius: BORDER_RADIUS,
  });
});
