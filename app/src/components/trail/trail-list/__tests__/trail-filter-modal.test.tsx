// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { TrailFilterModal } from "@/components/trail/trail-list/trail-filter-modal";
import { AppDefaultTheme } from "@/constants/theme";
import { FilterOptions } from "@/data/types";
import { getAllByType } from "@/test/composites";
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
  const found = getAllByType(RangeSlider).find(
    (node) => node.props.minimumValue === range.minimumValue && node.props.maximumValue === range.maximumValue,
  );
  if (!found) throw new Error(`expected a slider up to ${range.maximumValue}`);
  return found;
}

async function openSelect(currentLabel: string) {
  await fireEvent.press(screen.getByText(currentLabel));
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("turns a chosen city into a filter, and 'all cities' back into none", async () => {
  await show();

  await openSelect("Alla orter");
  await fireEvent.press(screen.getByText("Borås"));
  expect(onUpdateFilter).toHaveBeenCalledWith("city", "Borås");

  await show({ filters: { city: "Borås" } });
  await openSelect("Borås");
  await fireEvent.press(screen.getAllByText("Alla orter")[0]);
  expect(onUpdateFilter).toHaveBeenCalledWith("city", undefined);
});

// The select carries strings and the filter counts on a number. Classification 0 is a real class
// ("Inte klassificerad"), so only the empty string means no filter.
it("sends the difficulty back as a number, zero included", async () => {
  await show();

  await openSelect("Alla svårighetsgrader");
  await fireEvent.press(screen.getByText("Inte klassificerad"));
  expect(onUpdateFilter).toHaveBeenCalledWith("classification", 0);

  await show({ filters: { classification: 0 } });
  await openSelect("Inte klassificerad");
  await fireEvent.press(screen.getAllByText("Alla svårighetsgrader")[0]);
  expect(onUpdateFilter).toHaveBeenCalledWith("classification", undefined);
});

// Dragging fires every frame, so only the released value is committed to the list.
it("commits the length range on release, never while it is being dragged", async () => {
  await show();

  await act(() => slider(LENGTH_RANGE).props.onValueChange([4, 11]));
  expect(onUpdateLengthFilter).not.toHaveBeenCalled();
  // The label follows the drag, so the numbers under your thumb are the live ones.
  expect(screen.getByText("Ledlängd: 4 - 11 km")).toBeTruthy();

  await act(() => slider(LENGTH_RANGE).props.onSlidingComplete([4, 11]));
  expect(onUpdateLengthFilter).toHaveBeenCalledTimes(1);
  expect(onUpdateLengthFilter).toHaveBeenCalledWith(4, 11);
});

it("commits the distance the same way", async () => {
  await show({ hasLocation: true, filters: { nearMe: true } });

  await act(() => slider(DISTANCE_RANGE).props.onValueChange([25]));
  expect(onUpdateFilter).not.toHaveBeenCalled();
  expect(screen.getByText("Max avstånd: 25 km")).toBeTruthy();

  await act(() => slider(DISTANCE_RANGE).props.onSlidingComplete([25]));
  expect(onUpdateFilter).toHaveBeenCalledWith("maxDistance", 25);
});

// Without a fix there is nothing to measure from, so the section and its sort option stay away.
it("hides everything that needs a position until there is one", async () => {
  await show();

  expect(screen.queryByTestId("filter-nearme-on")).toBeNull();
  await openSelect("Namn (A-Ö)");
  expect(screen.queryByText("Närmast först")).toBeNull();
});

it("offers the nearest-first sort once there is a position", async () => {
  await show({ hasLocation: true });

  expect(screen.getByTestId("filter-nearme-on")).toBeTruthy();
  await openSelect("Namn (A-Ö)");
  await fireEvent.press(screen.getByText("Närmast först"));

  expect(onUpdateSort).toHaveBeenCalledWith("distance-asc");
});

it("hides the whole sort section where the list header owns sorting", async () => {
  await show({ showSort: false });

  expect(screen.queryByText("Sortera efter")).toBeNull();
});

// The distance slider is only meaningful once "near me" is on.
it("reveals the distance slider only while near-me is on", async () => {
  await show({ hasLocation: true });
  expect(screen.queryByText(/Max avstånd/)).toBeNull();

  await show({ hasLocation: true, filters: { nearMe: true } });
  expect(screen.getByText("Max avstånd: 50 km")).toBeTruthy();
});

it("sends a minimum rating back as a number, and 'all' as no filter", async () => {
  await show();

  await fireEvent.press(screen.getByTestId("filter-rating-4-5"));
  expect(onUpdateFilter).toHaveBeenCalledWith("minRating", 4.5);

  await fireEvent.press(screen.getByTestId("filter-rating-3"));
  expect(onUpdateFilter).toHaveBeenCalledWith("minRating", 3);

  await show({ filters: { minRating: 4 } });
  await fireEvent.press(screen.getAllByTestId("filter-rating-all")[0]);
  expect(onUpdateFilter).toHaveBeenCalledWith("minRating", undefined);
});

it("marks which rating step is active", async () => {
  await show({ filters: { minRating: 4 } });

  expect(screen.getByTestId("filter-rating-4")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.primary,
  });
  expect(screen.getByTestId("filter-rating-all")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.surface,
  });
});

it("offers the highest-rated sort", async () => {
  await show();

  await openSelect("Namn (A-Ö)");
  await fireEvent.press(screen.getByText("Högst betyg"));

  expect(onUpdateSort).toHaveBeenCalledWith("rating-desc");
});

it("marks which accessibility choice is active", async () => {
  await show({ filters: { accessibility: true } });

  expect(screen.getByTestId("filter-accessibility-adapted")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.primary,
  });
  expect(screen.getByTestId("filter-accessibility-all")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.surface,
  });
});

it("passes the header buttons straight through", async () => {
  await show();

  await fireEvent.press(screen.getByText("Rensa"));
  await fireEvent.press(screen.getByText("Klar"));

  expect(onClearFilters).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});
