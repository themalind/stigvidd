// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { TrailFilterModal } from "@/components/trail/trail-list/trail-filter-modal";
import { AppDefaultTheme } from "@/constants/theme";
import { FilterOptions } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { Slider as RangeSlider } from "@miblanchard/react-native-slider";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Platform } from "react-native";

const onClose = jest.fn();
const onUpdateFilter = jest.fn();
const onUpdateLengthFilter = jest.fn();
const onUpdateSort = jest.fn();
const onClearFilters = jest.fn();

// The selects are a native wheel on iOS, unreachable from a test, and plain rows on Android;
// driving them means being Android. See select-input.test.tsx.
beforeAll(() => {
  Platform.OS = "android";
});

afterAll(() => {
  Platform.OS = "ios";
});

function show(props: Partial<React.ComponentProps<typeof TrailFilterModal>> = {}) {
  const filters: FilterOptions = {};
  return renderWithProviders(
    <TrailFilterModal
      visible
      onClose={onClose}
      cities={["Borås", "Göteborg"]}
      classifications={[0, 1, 2]}
      filters={filters}
      sortBy="name-asc"
      onUpdateSort={onUpdateSort}
      onUpdateFilter={onUpdateFilter}
      onUpdateLengthFilter={onUpdateLengthFilter}
      onClearFilters={onClearFilters}
      hasLocation={false}
      {...props}
    />,
  );
}

// The sliders take no testID, so each is identified by the range it covers: kilometres of trail
// length, or kilometres away from you.
const LENGTH_RANGE = { minimumValue: 0, maximumValue: 150 };
const DISTANCE_RANGE = { minimumValue: 5, maximumValue: 200 };

function slider(range: { minimumValue: number; maximumValue: number }) {
  return (
    screen
      // The library's loose defaultProps keep the class from satisfying ComponentType, hence the cast.
      .UNSAFE_getAllByType(RangeSlider as never)
      .find((node) => node.props.minimumValue === range.minimumValue && node.props.maximumValue === range.maximumValue)!
  );
}

function openSelect(currentLabel: string) {
  fireEvent.press(screen.getByText(currentLabel));
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("turns a chosen city into a filter, and 'all cities' back into none", () => {
  show();

  openSelect("Alla orter");
  fireEvent.press(screen.getByText("Borås"));
  expect(onUpdateFilter).toHaveBeenCalledWith("city", "Borås");

  show({ filters: { city: "Borås" } });
  openSelect("Borås");
  fireEvent.press(screen.getAllByText("Alla orter")[0]);
  expect(onUpdateFilter).toHaveBeenCalledWith("city", undefined);
});

// The select carries strings and the filter counts on a number. Classification 0 is a real class
// ("Inte klassificerad"), so only the empty string means no filter.
it("sends the difficulty back as a number, zero included", () => {
  show();

  openSelect("Alla svårighetsgrader");
  fireEvent.press(screen.getByText("Inte klassificerad"));
  expect(onUpdateFilter).toHaveBeenCalledWith("classification", 0);

  show({ filters: { classification: 0 } });
  openSelect("Inte klassificerad");
  fireEvent.press(screen.getAllByText("Alla svårighetsgrader")[0]);
  expect(onUpdateFilter).toHaveBeenCalledWith("classification", undefined);
});

// Dragging fires every frame, so only the released value is committed to the list.
it("commits the length range on release, never while it is being dragged", () => {
  show();

  act(() => slider(LENGTH_RANGE).props.onValueChange([4, 11]));
  expect(onUpdateLengthFilter).not.toHaveBeenCalled();
  // The label follows the drag, so the numbers under your thumb are the live ones.
  expect(screen.getByText("Ledlängd: 4 - 11 km")).toBeTruthy();

  act(() => slider(LENGTH_RANGE).props.onSlidingComplete([4, 11]));
  expect(onUpdateLengthFilter).toHaveBeenCalledTimes(1);
  expect(onUpdateLengthFilter).toHaveBeenCalledWith(4, 11);
});

it("commits the distance the same way", () => {
  show({ hasLocation: true, filters: { nearMe: true } });

  act(() => slider(DISTANCE_RANGE).props.onValueChange([25]));
  expect(onUpdateFilter).not.toHaveBeenCalled();
  expect(screen.getByText("Max avstånd: 25 km")).toBeTruthy();

  act(() => slider(DISTANCE_RANGE).props.onSlidingComplete([25]));
  expect(onUpdateFilter).toHaveBeenCalledWith("maxDistance", 25);
});

// Without a fix there is nothing to measure from, so the section and its sort option stay away.
it("hides everything that needs a position until there is one", () => {
  show();

  expect(screen.queryByTestId("filter-nearme-on")).toBeNull();
  openSelect("Namn (A-Ö)");
  expect(screen.queryByText("Närmast först")).toBeNull();
});

it("offers the nearest-first sort once there is a position", () => {
  show({ hasLocation: true });

  expect(screen.getByTestId("filter-nearme-on")).toBeTruthy();
  openSelect("Namn (A-Ö)");
  fireEvent.press(screen.getByText("Närmast först"));

  expect(onUpdateSort).toHaveBeenCalledWith("distance-asc");
});

it("hides the whole sort section where the list header owns sorting", () => {
  show({ showSort: false });

  expect(screen.queryByText("Sortera efter")).toBeNull();
});

// The distance slider is only meaningful once "near me" is on.
it("reveals the distance slider only while near-me is on", () => {
  show({ hasLocation: true });
  expect(screen.queryByText(/Max avstånd/)).toBeNull();

  show({ hasLocation: true, filters: { nearMe: true } });
  expect(screen.getByText("Max avstånd: 50 km")).toBeTruthy();
});

it("sends a minimum rating back as a number, and 'all' as no filter", () => {
  show();

  fireEvent.press(screen.getByTestId("filter-rating-4-5"));
  expect(onUpdateFilter).toHaveBeenCalledWith("minRating", 4.5);

  fireEvent.press(screen.getByTestId("filter-rating-3"));
  expect(onUpdateFilter).toHaveBeenCalledWith("minRating", 3);

  show({ filters: { minRating: 4 } });
  fireEvent.press(screen.getAllByTestId("filter-rating-all")[0]);
  expect(onUpdateFilter).toHaveBeenCalledWith("minRating", undefined);
});

it("marks which rating step is active", () => {
  show({ filters: { minRating: 4 } });

  expect(screen.getByTestId("filter-rating-4")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.primary,
  });
  expect(screen.getByTestId("filter-rating-all")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.surface,
  });
});

it("offers the highest-rated sort", () => {
  show();

  openSelect("Namn (A-Ö)");
  fireEvent.press(screen.getByText("Högst betyg"));

  expect(onUpdateSort).toHaveBeenCalledWith("rating-desc");
});

it("marks which accessibility choice is active", () => {
  show({ filters: { accessibility: true } });

  expect(screen.getByTestId("filter-accessibility-adapted")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.primary,
  });
  expect(screen.getByTestId("filter-accessibility-all")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.surface,
  });
});

it("passes the header buttons straight through", () => {
  show();

  fireEvent.press(screen.getByText("Rensa"));
  fireEvent.press(screen.getByText("Klar"));

  expect(onClearFilters).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});
