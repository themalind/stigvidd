// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AreaDetailScreen from "@/components/area/area-detail-screen";
import { SCREEN_PADDING } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { CityArea, CityAreaTrail, Facility, FacilityType } from "@/data/types";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { ActivityIndicator, Platform, Text } from "react-native";

const mockGetArea = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();

jest.mock("@/api/areas", () => ({
  getAreaByIdentifier: (...args: unknown[]) => mockGetArea(...args),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ identifier: "kransmossen" }),
  router: {
    navigate: (...args: unknown[]) => mockNavigate(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

function facility(overrides: Partial<Facility> = {}): Facility {
  return {
    identifier: "f-1",
    name: "Grillplatsen vid sjön",
    facilityType: FacilityType.FirePit,
    isAccessible: false,
    ...overrides,
  };
}

function trail(overrides: Partial<CityAreaTrail> = {}): CityAreaTrail {
  return {
    identifier: "t-1",
    name: "Kvarnstigen",
    trailLength: 4.2,
    classification: 1,
    averageRating: 4,
    ...overrides,
  };
}

function area(overrides: Partial<CityArea> = {}): CityArea {
  return {
    identifier: "kransmossen",
    name: "Kransmossen",
    location: "Borås",
    description: "Ett friluftsområde med spår året runt.",
    imageUrl: "https://media.example/area.jpg",
    facilities: [],
    trails: [],
    ...overrides,
  };
}

async function show(
  overrides: Partial<CityArea> = {},
  theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme,
) {
  mockGetArea.mockResolvedValue(area(overrides));
  const rendered = renderWithProviders(<AreaDetailScreen />, { theme });
  await flushUntil(() => screen.queryByTestId("area-hero"));
  return rendered;
}

// Paper's Icon hides itself from accessibility, so it needs includeHiddenElements.
function paperIcon(name: string) {
  return screen.queryByTestId(`icon-${name}`, { includeHiddenElements: true });
}

// A block with no content renders nothing at all: the column has gap: 20, so an empty <Text> is
// 20 px of blank space no text query can see.
function emptyTextNodes() {
  return screen.UNSAFE_queryAllByType(Text).filter((node) => {
    const children = node.props.children;
    return children === undefined || children === null || children === "";
  });
}

// A trail card carries a length too, so the summary is read from the stats row itself.
function stat(pattern: RegExp) {
  return within(screen.getByTestId("area-stats")).queryByText(pattern);
}

beforeEach(() => {
  jest.clearAllMocks();
  // guardedNavigate debounces on module state for 500 ms, which would swallow the next test's press.
  let clock = 6_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("asks for the area named in the route", async () => {
  await show();

  expect(mockGetArea).toHaveBeenCalledWith("kransmossen");
});

// A half-built hero over a missing name is worse than nothing to look at.
it("draws nothing but a spinner until the area is in", () => {
  mockGetArea.mockReturnValue(new Promise(() => {}));
  renderWithProviders(<AreaDetailScreen />);

  expect(screen.queryByTestId("area-hero")).toBeNull();
  expect(screen.queryByText("Kransmossen")).toBeNull();
  expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
});

it("offers a retry instead of a blank page when the area cannot be fetched", async () => {
  mockGetArea.mockRejectedValue(new Error("network"));
  renderWithProviders(<AreaDetailScreen />);
  await flushUntil(() => screen.queryByText("Försök igen"));

  expect(screen.queryByTestId("area-hero")).toBeNull();

  mockGetArea.mockResolvedValue(area());
  fireEvent.press(screen.getByText("Försök igen"));
  await flushUntil(() => screen.queryByTestId("area-hero"));

  expect(screen.getByText("Kransmossen")).toBeTruthy();
});

// react-query refuses an undefined result, so a 200 with no body reaches the screen as a failed query.
it("treats an empty response as an error rather than reading through it", async () => {
  mockGetArea.mockResolvedValue(undefined);
  renderWithProviders(<AreaDetailScreen />);
  await flushUntil(() => screen.queryByText("Något gick fel"));

  expect(screen.getByText("Något gick fel")).toBeTruthy();
  expect(screen.queryByTestId("area-hero")).toBeNull();
});

it("shows the area's name, place and description", async () => {
  await show();

  expect(screen.getByText("Kransmossen")).toBeTruthy();
  expect(screen.getByText("Borås")).toBeTruthy();
  expect(screen.getByText("Ett friluftsområde med spår året runt.")).toBeTruthy();
});

it("leaves the place row out when the area has no place", async () => {
  await show({ location: "" });

  expect(screen.getByText("Kransmossen")).toBeTruthy();
  expect(screen.queryByText("Borås")).toBeNull();
  // The pin would otherwise be drawn next to an empty line.
  expect(paperIcon("map-marker")).toBeNull();
});

it("leaves the description out rather than an empty paragraph", async () => {
  await show({ description: undefined });

  expect(screen.queryByText("Ett friluftsområde med spår året runt.")).toBeNull();
  expect(emptyTextNodes()).toHaveLength(0);
});

// The title sits on the hero photo, so it is light in both themes.
it("keeps the hero a fixed height with a light title over the photo", async () => {
  await show({}, AppDarkTheme);

  expect(screen.getByTestId("area-hero")).toHaveStyle({ height: 260, width: "100%", justifyContent: "flex-end" });
  expect(screen.getByText("Kransmossen")).toHaveStyle({ color: "#fff", fontSize: 26 });
  expect(screen.getByText("Borås")).toHaveStyle({ color: "rgba(255,255,255,0.9)" });
});

it("clamps a long area name to two lines and the place to one", async () => {
  await show();

  expect(screen.getByText("Kransmossen").props.numberOfLines).toBe(2);
  expect(screen.getByText("Borås").props.numberOfLines).toBe(1);
});

// Android draws its own back affordance in the header, so the photo carries none.
it("puts a back button over the hero on iOS only", async () => {
  await show();
  expect(screen.getByTestId("area-back")).toBeTruthy();

  Platform.OS = "android";
  try {
    await show();
    expect(screen.queryByTestId("area-back")).toBeNull();
  } finally {
    Platform.OS = "ios";
  }
});

it("goes back when the hero's back button is pressed", async () => {
  await show();

  fireEvent.press(screen.getByTestId("area-back"));

  expect(mockBack).toHaveBeenCalled();
});

it("counts the trails and adds up their length", async () => {
  await show({ trails: [trail({ trailLength: 4.2 }), trail({ identifier: "t-2", trailLength: 9.1 })] });

  expect(stat(/2 leder/)).toBeTruthy();
  expect(stat(/13 km/)).toBeTruthy();
});

// Lengths are decimal kilometres and the summary is whole, so 11.5 rounds rather than truncates.
it("rounds the total rather than cutting it off", async () => {
  await show({ trails: [trail({ trailLength: 2.4 }), trail({ identifier: "t-2", trailLength: 9.1 })] });

  expect(stat(/12 km/)).toBeTruthy();
});

it("counts a trail whose length is missing without turning the total into NaN", async () => {
  await show({
    trails: [trail({ trailLength: undefined as unknown as number }), trail({ identifier: "t-2", trailLength: 3 })],
  });

  expect(stat(/2 leder/)).toBeTruthy();
  expect(stat(/3 km/)).toBeTruthy();
});

it("drops the stats row entirely for an area with no trails", async () => {
  await show({ trails: [] });

  expect(screen.queryByTestId("area-stats")).toBeNull();
});

// A trail with no recorded length still counts as a trail; "0 km" says nothing.
it("names the trails but not a zero total", async () => {
  await show({ trails: [trail({ trailLength: 0 })] });

  expect(stat(/1 leder/)).toBeTruthy();
  expect(stat(/km/)).toBeNull();
});

it("hides the trail section for an area that has none", async () => {
  await show({ trails: [] });

  expect(screen.queryByText("Vandring, motion & promenadstigar")).toBeNull();
});

it("lists each trail with its length, difficulty and rating", async () => {
  await show({ trails: [trail({ classification: 1, trailLength: 4.2, averageRating: 4.5 })] });

  expect(screen.getByText("Vandring, motion & promenadstigar")).toBeTruthy();
  expect(screen.getByText("Kvarnstigen")).toBeTruthy();
  expect(screen.getByText("4.2 km")).toBeTruthy();
  expect(screen.getByText("Lätt")).toBeTruthy();
  expect(screen.getByText("★ 4.5")).toBeTruthy();
});

// The difficulty word alone is the whole cue for anyone who reads the shape instead.
it("marks each difficulty with its own icon", async () => {
  await show({
    trails: [
      trail({ identifier: "t-1", classification: 1 }),
      trail({ identifier: "t-2", classification: 2 }),
      trail({ identifier: "t-3", classification: 3 }),
    ],
  });

  expect(screen.getByTestId("icon-circle")).toBeTruthy();
  expect(screen.getByTestId("icon-diamond")).toBeTruthy();
  expect(screen.getByTestId("icon-triangle")).toBeTruthy();
});

it("says a trail has no reviews rather than showing it zero stars", async () => {
  await show({ trails: [trail({ averageRating: 0 })] });

  expect(screen.getByText("Det finns inga recensioner här ännu.")).toBeTruthy();
  expect(screen.queryByText("★ 0.0")).toBeNull();
});

it("opens the trail that was pressed", async () => {
  await show({ trails: [trail({ identifier: "t-9" })] });

  fireEvent.press(screen.getByTestId("area-trail-t-9"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(home)/trail/[identifier]",
    params: { identifier: "t-9" },
  });
});

it("clamps a trail's description to two lines", async () => {
  await show({ trails: [trail({ description: "En stig längs ån, mestadels grus." })] });

  expect(screen.getByText("En stig längs ån, mestadels grus.").props.numberOfLines).toBe(2);
});

it("hides the facility section for an area that has none", async () => {
  await show({ facilities: [] });

  expect(screen.queryByText("Faciliteter")).toBeNull();
});

it("groups the facilities under the kind they are", async () => {
  await show({
    facilities: [
      facility({ identifier: "f-1", name: "Grillplatsen", facilityType: FacilityType.FirePit }),
      facility({ identifier: "f-2", name: "Vindskyddet", facilityType: FacilityType.Shelter }),
      facility({ identifier: "f-3", name: "Bryggan", facilityType: FacilityType.SwimmingArea }),
    ],
  });

  expect(screen.getByText("Faciliteter")).toBeTruthy();
  expect(within(screen.getByTestId("facility-section-outdoor-grill")).getByText("Grillplatsen")).toBeTruthy();
  expect(within(screen.getByTestId("facility-section-cabin")).getByText("Vindskyddet")).toBeTruthy();
  expect(within(screen.getByTestId("facility-section-pool")).getByText("Bryggan")).toBeTruthy();
});

// facilityType is a [Flags] bitmask: a fire pit under a shelter is 3 and belongs in both lists.
it("lists a combined facility under every kind it carries", async () => {
  await show({
    facilities: [
      facility({
        identifier: "f-1",
        name: "Grillplats under tak",
        facilityType: FacilityType.FirePit | FacilityType.Shelter,
      }),
    ],
  });

  expect(within(screen.getByTestId("facility-section-outdoor-grill")).getByText("Grillplats under tak")).toBeTruthy();
  expect(within(screen.getByTestId("facility-section-cabin")).getByText("Grillplats under tak")).toBeTruthy();
});

it("leaves out the groups nothing falls into", async () => {
  await show({ facilities: [facility({ facilityType: FacilityType.FirePit })] });

  expect(screen.getByTestId("facility-section-outdoor-grill")).toBeTruthy();
  expect(screen.queryByTestId("facility-section-cabin")).toBeNull();
  expect(screen.queryByTestId("facility-section-set-meal")).toBeNull();
  expect(screen.queryByTestId("facility-section-pool")).toBeNull();
  expect(screen.queryByTestId("facility-section-park")).toBeNull();
});

it("names each group and heads it with its own icon", async () => {
  await show({
    facilities: [
      facility({ identifier: "f-1", facilityType: FacilityType.FirePit }),
      facility({ identifier: "f-2", facilityType: FacilityType.FishingArea }),
      facility({ identifier: "f-3", facilityType: FacilityType.NatureReserve }),
    ],
  });

  expect(screen.getByText("Grillplatser")).toBeTruthy();
  expect(screen.getByText("Fiske")).toBeTruthy();
  expect(screen.getByText("Naturreservat")).toBeTruthy();
  expect(screen.getByTestId("icon-outdoor-grill")).toBeTruthy();
  expect(screen.getByTestId("icon-set-meal")).toBeTruthy();
  expect(screen.getByTestId("icon-park")).toBeTruthy();
});

it("shows a facility's place and description when it has them", async () => {
  await show({
    facilities: [facility({ location: "Vid norra parkeringen", description: "Ved finns på plats." })],
  });

  expect(screen.getByText("Vid norra parkeringen")).toBeTruthy();
  expect(screen.getByText("Ved finns på plats.")).toBeTruthy();
  expect(screen.getByTestId("icon-place")).toBeTruthy();
});

it("leaves out the place row for a facility with no place", async () => {
  await show({ facilities: [facility({ location: undefined, description: undefined })] });

  expect(screen.getByText("Grillplatsen vid sjön")).toBeTruthy();
  expect(screen.queryByTestId("icon-place")).toBeNull();
  expect(emptyTextNodes()).toHaveLength(0);
});

it("fills the screen on the theme's background", async () => {
  await show();

  expect(screen.getByTestId("area-screen")).toHaveStyle({
    flex: 1,
    backgroundColor: AppDefaultTheme.colors.background,
  });
});

it("fills the screen on the dark theme's background too", async () => {
  await show({}, AppDarkTheme);

  expect(screen.getByTestId("area-screen")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.background });
});

// Everything below the hero shares one gutter; the hero's content is inset further to clear the rounded photo.
it("keeps the body text on one gutter", async () => {
  await show({ trails: [trail()] });

  expect(screen.getByText("Ett friluftsområde med spår året runt.")).toHaveStyle({
    paddingHorizontal: SCREEN_PADDING + 4,
  });
  expect(screen.getByText("Vandring, motion & promenadstigar")).toHaveStyle({
    paddingHorizontal: SCREEN_PADDING + 4,
  });
});

it("colours the section headings and stats for the theme it is drawn in", async () => {
  await show({ trails: [trail()] }, AppDarkTheme);

  expect(screen.getByText("Vandring, motion & promenadstigar")).toHaveStyle({
    color: AppDarkTheme.colors.onBackground,
  });
  expect(stat(/1 leder/)).toHaveStyle({ color: AppDarkTheme.colors.onBackground });
});
