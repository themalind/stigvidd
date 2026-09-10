// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import ListHeaderAction, { SortField } from "@/components/list-header-actions";
import { AppDefaultTheme } from "@/constants/theme";
import { stubMeasureInWindow } from "@/test/measure";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, Text } from "react-native";

const onSearchChange = jest.fn();
const onSortChange = jest.fn();
const onOpenFilters = jest.fn();
const onClearFilters = jest.fn();

// A field key with a dash in it: the direction splits off the last dash.
const SORT_FIELDS: SortField[] = [
  { key: "name", labelKey: "filter.fieldName" },
  { key: "shared-date", labelKey: "filter.fieldShared", defaultDirection: "desc" },
];

let measured: ReturnType<typeof stubMeasureInWindow>;

beforeAll(() => {
  measured = stubMeasureInWindow();
});

afterAll(() => {
  measured.restore();
});

function show(props: Partial<React.ComponentProps<typeof ListHeaderAction>> = {}) {
  return renderWithProviders(
    <ListHeaderAction
      searchQuery=""
      onSearchChange={onSearchChange}
      searchPlaceholder="Sök promenad"
      sortFields={SORT_FIELDS}
      sortBy="name-asc"
      onSortChange={onSortChange}
      onOpenFilters={onOpenFilters}
      activeFilterCount={0}
      showingLabel="Visar 3 av 12"
      onClearFilters={onClearFilters}
      {...props}
    >
      <Text>Mina promenader</Text>
    </ListHeaderAction>,
  );
}

function openSearch() {
  fireEvent.press(screen.getByTestId("icon-search"));
}

function openSort() {
  fireEvent.press(screen.getByTestId("icon-filter-list"));
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("keeps the header itself out of the way until an icon is pressed", () => {
  show();

  expect(screen.getByText("Mina promenader")).toBeTruthy();
  expect(screen.queryByPlaceholderText("Sök promenad")).toBeNull();
  expect(screen.queryByText("Fler filter…")).toBeNull();
});

// The two panels share one slot under the header, so opening either closes the other.
it("never has both panels open at once", () => {
  show();

  openSearch();
  expect(screen.getByPlaceholderText("Sök promenad")).toBeTruthy();

  openSort();
  expect(screen.queryByPlaceholderText("Sök promenad")).toBeNull();
  expect(screen.getByText("Fler filter…")).toBeTruthy();

  openSearch();
  expect(screen.getByPlaceholderText("Sök promenad")).toBeTruthy();
  expect(screen.queryByText("Fler filter…")).toBeNull();
});

it("reports what is typed and closes on the field's own clear", () => {
  show({ searchQuery: "kväll" });

  openSearch();
  fireEvent.changeText(screen.getByPlaceholderText("Sök promenad"), "morgon");
  expect(onSearchChange).toHaveBeenCalledWith("morgon");
});

// The field collapses on blur, so the icon carries the live query.
it("tints the search icon while a query is active", () => {
  const { rerender } = show();
  expect(screen.getByTestId("icon-search").props.color).toBe(AppDefaultTheme.colors.onBackground);

  rerender(
    <ListHeaderAction
      searchQuery="kväll"
      onSearchChange={onSearchChange}
      searchPlaceholder="Sök promenad"
      sortFields={SORT_FIELDS}
      sortBy="name-asc"
      onSortChange={onSortChange}
      onOpenFilters={onOpenFilters}
      activeFilterCount={0}
      showingLabel="Visar 3 av 12"
      onClearFilters={onClearFilters}
    >
      <Text>Mina promenader</Text>
    </ListHeaderAction>,
  );

  expect(screen.getByTestId("icon-search").props.color).toBe(AppDefaultTheme.colors.primary);
});

// Tapping the field already sorted by reverses it, which is the only way to a descending name sort.
it("flips the direction when the active field is picked again", () => {
  show({ sortBy: "name-asc" });

  openSort();
  fireEvent.press(screen.getByText("Namn"));

  expect(onSortChange).toHaveBeenCalledWith("name-desc");
});

// A date is most useful newest-first, so each field brings its own first direction.
it("uses a field's own default direction the first time it is picked", () => {
  show({ sortBy: "name-asc" });

  openSort();
  fireEvent.press(screen.getByText("Delningsdatum"));

  expect(onSortChange).toHaveBeenCalledWith("shared-date-desc");
});

// "shared-date-desc" splits on its last dash; the first would sort by a field called "shared".
it("splits a field key that contains a dash at the right place", () => {
  show({ sortBy: "shared-date-desc" });

  openSort();
  fireEvent.press(screen.getByText("Delningsdatum"));

  expect(onSortChange).toHaveBeenCalledWith("shared-date-asc");
});

it("marks the active field with the direction it is sorted in", () => {
  const { unmount } = show({ sortBy: "name-asc" });
  openSort();
  expect(screen.getByTestId("icon-arrow-upward")).toBeTruthy();
  unmount();

  show({ sortBy: "name-desc" });
  openSort();
  expect(screen.getByTestId("icon-arrow-downward")).toBeTruthy();
});

// The popover is portalled, so it carries its own full-screen catcher for presses outside it.
it("closes the sort menu when the screen behind it is pressed", () => {
  show();

  openSort();
  fireEvent.press(screen.getByLabelText("Stäng"));

  expect(screen.queryByText("Fler filter…")).toBeNull();
});

it("positions the menu under its anchor, against the right edge", () => {
  show();

  openSort();

  const { x, y, width, height } = measured.rect;
  expect(screen.getByTestId("sort-popover")).toHaveStyle({
    top: y + height + 8,
    right: Dimensions.get("window").width - (x + width),
  });
});

it("hands the full filter sheet over from the menu", () => {
  show();

  openSort();
  fireEvent.press(screen.getByText("Fler filter…"));

  expect(onOpenFilters).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Fler filter…")).toBeNull();
});

// The counter row appears only once something is filtering, so an untouched page keeps its height.
it("shows the counter row only while a filter or a query is active", () => {
  const { unmount } = show();
  expect(screen.queryByText("Visar 3 av 12")).toBeNull();
  unmount();

  show({ activeFilterCount: 2 });
  expect(screen.getByText("Visar 3 av 12")).toBeTruthy();
  expect(screen.getByText("2")).toBeTruthy();

  fireEvent.press(screen.getByText("Rensa filter"));
  expect(onClearFilters).toHaveBeenCalledTimes(1);
});

it("counts a search query as active even with no filters set", () => {
  show({ searchQuery: "kväll" });

  expect(screen.getByText("Visar 3 av 12")).toBeTruthy();
});
