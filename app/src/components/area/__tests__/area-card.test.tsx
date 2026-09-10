// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AreaCard from "@/components/area/area-card";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { CityArea, Facility, FacilityType } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

function facility(facilityType: number): Facility {
  return { identifier: `f-${facilityType}`, name: "Plats", facilityType, isAccessible: false };
}

function area(overrides: Partial<CityArea> = {}): CityArea {
  return {
    identifier: "area-1",
    name: "Kransmossen",
    location: "Borås",
    description: "Ett friluftsområde med spår året runt.",
    imageUrl: "https://media.example/area.jpg",
    facilities: [],
    trails: [
      { identifier: "t1", name: "Kort", trailLength: 2.4, classification: 1, averageRating: 4 },
      { identifier: "t2", name: "Lång", trailLength: 9.1, classification: 2, averageRating: 3 },
    ],
    ...overrides,
  };
}

// The two themes are structurally distinct after deepmerge, so the parameter admits both.
function show(
  overrides: Partial<CityArea> = {},
  theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme,
) {
  return renderWithProviders(<AreaCard area={area(overrides)} />, { theme });
}

beforeEach(() => {
  jest.clearAllMocks();
  let clock = 5_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("names the area, where it is, and what it holds", () => {
  show();

  expect(screen.getByText("Kransmossen")).toBeTruthy();
  expect(screen.getByText("Borås")).toBeTruthy();
  expect(screen.getByText("2 leder")).toBeTruthy();
  expect(screen.getByText("Ett friluftsområde med spår året runt.")).toBeTruthy();
});

// Lengths are summed and rounded, not listed: 2.4 + 9.1 is 12 km on the card.
it("sums the trail lengths to a whole number of kilometres", () => {
  show();

  expect(screen.getByText("12 km")).toBeTruthy();
});

it("opens the area that was tapped", () => {
  show();

  fireEvent.press(screen.getByText("Kransmossen"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(home)/area/[identifier]",
    params: { identifier: "area-1" },
  });
});

// FacilityType is a [Flags] enum, so membership is bitwise; equality would drop the combined values.
it("reads a combined facility as both of its kinds", () => {
  show({ facilities: [facility(FacilityType.FirePit | FacilityType.Shelter)] });

  expect(screen.getByLabelText("Grillplatser")).toBeTruthy();
  expect(screen.getByLabelText("Vindskydd")).toBeTruthy();
  expect(screen.queryByLabelText("Fiske")).toBeNull();
});

it("shows one chip per kind, however many facilities carry it", () => {
  show({
    facilities: [facility(FacilityType.FirePit), facility(FacilityType.FirePit), facility(FacilityType.SwimmingArea)],
  });

  expect(screen.getAllByLabelText("Grillplatser")).toHaveLength(1);
  expect(screen.getByLabelText("Badplatser")).toBeTruthy();
});

// An area without trails is a real place, so the card shows neither "0 leder" nor "0 km".
it("leaves out the counts an empty area would show as zero", () => {
  show({ facilities: [facility(FacilityType.NatureReserve)], trails: [] });

  expect(screen.queryByText(/leder/)).toBeNull();
  expect(screen.queryByText(/km/)).toBeNull();
  expect(screen.getByLabelText("Naturreservat")).toBeTruthy();
});

it("drops the rows it has nothing to put in", () => {
  show({ location: "", description: undefined });

  expect(screen.getByText("Kransmossen")).toBeTruthy();
  expect(screen.queryByText("Borås")).toBeNull();
  expect(screen.queryByText("Ett friluftsområde med spår året runt.")).toBeNull();
});

// The card is one fixed tile in a list, so neither the name over the photo nor the description grows it.
it("clamps the name to a line and the description to two", () => {
  show();

  expect(screen.getByText("Kransmossen").props.numberOfLines).toBe(1);
  expect(screen.getByText("Ett friluftsområde med spår året runt.").props.numberOfLines).toBe(2);
});

// In dark mode the card lifts onto an elevation and the accent switches to the colour that reads there.
it("lifts the card and switches its accent in the dark theme", () => {
  const { unmount } = show();
  expect(screen.getByTestId("area-card")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.surface });
  expect(screen.getByTestId("area-card-accent")).toHaveStyle({ backgroundColor: AppDefaultTheme.colors.tertiary });
  unmount();

  show({}, AppDarkTheme);
  expect(screen.getByTestId("area-card")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.elevation.level2 });
  expect(screen.getByTestId("area-card-accent")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.primary });
});
