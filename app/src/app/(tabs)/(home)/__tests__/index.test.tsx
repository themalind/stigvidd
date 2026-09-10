// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { SCREEN_PADDING, SURFACE_BORDER_RADIUS } from "@/constants/constants";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { Hike, TrailOverview } from "@/data/types";
import PagerCarouselSkeleton from "@/components/skeletons/pager-carousel-skeleton";
import { LatestHikeState } from "@/hooks/hike/useLatestHike";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import HomeScreen from "../index";

const mockGetPopularTrails = jest.fn();
const mockNavigate = jest.fn();

let mockLocation: { data?: { latitude: number; longitude: number; isFallback: boolean }; isPending: boolean };
let mockLatest: LatestHikeState;

jest.mock("@/api/trails", () => ({
  getPopularTrails: (...args: unknown[]) => mockGetPopularTrails(...args),
}));

jest.mock("@/hooks/useUserLocation", () => ({
  useUserLocation: () => mockLocation,
}));

jest.mock("@/hooks/hike/useLatestHike", () => ({
  useLatestHike: () => mockLatest,
}));

// The banner's own two queries would reach the network; it has a suite of its own.
jest.mock("@/hooks/useWeather", () => ({ useWeather: () => ({ data: undefined }) }));
jest.mock("@/hooks/useCityName", () => ({ useCityName: () => ({ data: "Borås", isPending: false }) }));

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require("react");
  return {
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
    useRouter: () => ({ navigate: mockNavigate, back: jest.fn() }),
    router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  };
});

// Borås city hall, which useUserLocation hands out when there is no permission or fix.
const FALLBACK = { latitude: 57.721, longitude: 12.94, isFallback: true };
const HERE = { latitude: 57.65, longitude: 13.02, isFallback: false };

const TRAILS: TrailOverview[] = [
  { identifier: "trail-1", name: "Skogsleden", trailLength: 4.2, averageRating: 4 },
  { identifier: "trail-2", name: "Sjöleden", trailLength: 7.5, averageRating: 3 },
];

const HIKE = {
  identifier: "hike-1",
  name: "Kvällspromenad",
  hikeLength: 3.2,
  duration: 3_600_000,
  createdAt: "2026-09-01T18:00:00Z",
  coordinates: JSON.stringify([
    { latitude: 57.72, longitude: 12.94 },
    { latitude: 57.73, longitude: 12.95 },
  ]),
} as unknown as Hike;

let clock = 4_000_000;

function show(theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<HomeScreen />, { theme });
}

async function showLoaded() {
  show();
  await flushUntil(() => screen.queryByText("Skogsleden"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocation = { data: HERE, isPending: false };
  mockLatest = { kind: "signedOut" };
  mockGetPopularTrails.mockResolvedValue(TRAILS);
  // guardedNavigate debounces on module state for 500 ms across the whole file.
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("ranks the popular trails around the user's position", async () => {
  await showLoaded();

  expect(mockGetPopularTrails).toHaveBeenCalledWith(HERE.latitude, HERE.longitude);
  expect(screen.getByText("Populära promenader nära dig")).toBeTruthy();
});

// The Borås fallback is not the user's position, so it is never sent as one.
it("never sends the Borås fallback to the API", async () => {
  mockLocation = { data: FALLBACK, isPending: false };
  await showLoaded();

  expect(mockGetPopularTrails).toHaveBeenCalledWith(undefined, undefined);
  expect(screen.getByText("Populära promenader")).toBeTruthy();
  expect(screen.queryByText("Populära promenader nära dig")).toBeNull();
});

// Asking before the position lands would fetch twice and rank the first answer by nothing.
it("waits for the position before it asks", async () => {
  mockLocation = { isPending: true };
  show();
  await settle();

  expect(mockGetPopularTrails).not.toHaveBeenCalled();
});

it("holds the carousel's place until the trails arrive", async () => {
  let release: (trails: TrailOverview[]) => void = () => {};
  mockGetPopularTrails.mockReturnValue(new Promise<TrailOverview[]>((resolve) => (release = resolve)));
  show();
  await settle();

  expect(screen.queryByText("Skogsleden")).toBeNull();
  // The placeholder is what keeps the cards below from jumping when the trails land.
  expect(screen.UNSAFE_queryByType(PagerCarouselSkeleton)).toBeTruthy();

  release(TRAILS);
  await flushUntil(() => screen.queryByText("Skogsleden"));

  expect(screen.getByText("Skogsleden")).toBeTruthy();
  expect(screen.getByText("Sjöleden")).toBeTruthy();
  expect(screen.UNSAFE_queryByType(PagerCarouselSkeleton)).toBeNull();
});

// One personal card at a time: the pitch for a user with no walks, the walk otherwise.
it("pitches recording to a signed-out visitor", async () => {
  await showLoaded();

  expect(screen.getByText("Din nästa promenad börjar här")).toBeTruthy();
  expect(screen.getByText("Logga in")).toBeTruthy();
  expect(screen.queryByText("Din senaste promenad")).toBeNull();
});

it("pitches the first walk to a signed-in user who has none", async () => {
  mockLatest = { kind: "empty" };
  await showLoaded();

  expect(screen.getByText("Redo för din första promenad?")).toBeTruthy();
  expect(screen.getByText("Spela in en promenad")).toBeTruthy();
});

it("shows the latest walk instead once there is one", async () => {
  mockLatest = { kind: "hike", hike: HIKE };
  await showLoaded();

  expect(screen.getByText("Din senaste promenad")).toBeTruthy();
  expect(screen.getByText("Kvällspromenad")).toBeTruthy();
  expect(screen.queryByText("Din nästa promenad börjar här")).toBeNull();
  expect(screen.queryByText("Redo för din första promenad?")).toBeNull();
});

// The skeleton holds the card's slot under the heading so a late card does not shift the page.
it("holds the walk's place, heading and all, while it is still loading", async () => {
  mockLatest = { kind: "loading" };
  await showLoaded();

  expect(screen.getByText("Din senaste promenad")).toBeTruthy();
  expect(screen.queryByText("Kvällspromenad")).toBeNull();
  expect(screen.queryByText("Din nästa promenad börjar här")).toBeNull();
});

it("opens the nature guide", async () => {
  await showLoaded();

  fireEvent.press(screen.getByTestId("home-guide-card"));

  expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(settings)/guide");
});

it("opens the area list", async () => {
  await showLoaded();

  fireEvent.press(screen.getByTestId("home-areas-card"));

  expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(home)/area/area-list-screen");
});

it("names both bottom cards", async () => {
  await showLoaded();

  expect(screen.getByText("Naturguide")).toBeTruthy();
  expect(screen.getByText("Allemansrätt · Svårighetsgrader")).toBeTruthy();
  expect(screen.getByText("Utforska Borås")).toBeTruthy();
  expect(screen.getByText("Rya åsar · Kype · m.fl.")).toBeTruthy();
});

it("fills the screen with the theme's background", async () => {
  await showLoaded();

  expect(StyleSheet.flatten(screen.getByTestId("home-scroll").props.contentContainerStyle)).toMatchObject({
    flexGrow: 1,
    gap: 12,
    backgroundColor: AppDefaultTheme.colors.background,
  });
});

it("fills the screen with the dark theme's background too", async () => {
  show(AppDarkTheme);
  await flushUntil(() => screen.queryByText("Skogsleden"));

  expect(StyleSheet.flatten(screen.getByTestId("home-scroll").props.contentContainerStyle)).toMatchObject({
    backgroundColor: AppDarkTheme.colors.background,
  });
});

// The two cards share the row evenly whatever their text does, and clip their own images.
it("splits the bottom row evenly between the two cards", async () => {
  await showLoaded();

  expect(screen.getByTestId("home-card-row")).toHaveStyle({
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    paddingHorizontal: SCREEN_PADDING,
  });
  for (const card of ["home-guide-card", "home-areas-card"]) {
    expect(screen.getByTestId(card)).toHaveStyle({
      flex: 1,
      borderRadius: SURFACE_BORDER_RADIUS,
      overflow: "hidden",
    });
  }
});
