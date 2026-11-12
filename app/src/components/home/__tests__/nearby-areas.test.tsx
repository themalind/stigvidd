// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import NearbyAreas from "@/components/home/nearby-areas";
import { CityArea, FacilityType } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen, within } from "@testing-library/react-native";

const mockGetAreas = jest.fn();
jest.mock("@/api/areas", () => ({ getAreas: (...args: unknown[]) => mockGetAreas(...args) }));

let mockLocation: { data?: { latitude: number; longitude: number; isFallback: boolean }; isPending: boolean };
jest.mock("@/hooks/location/useUserLocation", () => ({ useUserLocation: () => mockLocation }));

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({ router: { navigate: (...args: unknown[]) => mockNavigate(...args) } }));

let clock = 7_000_000;

function area(identifier: string, name: string, distanceKm: number | null): CityArea {
  return {
    identifier,
    name,
    location: "",
    municipality: "Borås",
    distanceKm,
    facilities: [{ identifier: "f", name: "", facilityType: FacilityType.SwimmingArea, isAccessible: false }],
    trails: [
      { identifier: "t1", name: "", trailLength: 3, classification: 1, averageRating: 0 },
      { identifier: "t2", name: "", trailLength: 4, classification: 1, averageRating: 0 },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocation = { data: { latitude: 57.721, longitude: 12.94, isFallback: false }, isPending: false };
  // keep-comment: guardedNavigate debounces on module state, so the clock only ever moves on
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("shows the destinations within the nearby radius, nearest first, with distance and summary", async () => {
  mockGetAreas.mockResolvedValue([
    area("rya", "Rya åsar", 2.3),
    area("almenas", "Almenäs", 4.8),
    area("far", "Långt bort", 80),
  ]);
  await renderWithProviders(<NearbyAreas />);
  await flushUntil(() => screen.queryByTestId("home-areas"));

  expect(mockGetAreas).toHaveBeenCalledWith(57.72, 12.94);
  expect(screen.getByText("Utflyktsmål nära dig")).toBeTruthy();
  expect(screen.getByTestId("home-area-rya")).toBeTruthy();
  expect(screen.getByTestId("home-area-almenas")).toBeTruthy();
  expect(screen.queryByTestId("home-area-far")).toBeNull();
  expect(screen.getByText("2,3 km")).toBeTruthy();
  expect(screen.getAllByText("Borås · 2 leder")).toHaveLength(2);
  expect(screen.getAllByLabelText("Bad")).toHaveLength(2);
});

it("shows the popular destinations when none is nearby", async () => {
  mockGetAreas.mockImplementation((latitude?: number) =>
    Promise.resolve(latitude === undefined ? [area("kiruna", "Kiruna", null)] : [area("far", "Långt bort", 80)]),
  );
  await renderWithProviders(<NearbyAreas />);
  await flushUntil(() => screen.queryByTestId("home-area-kiruna"));

  expect(screen.getByText("Populära utflyktsmål")).toBeTruthy();
  expect(screen.queryByTestId("home-area-far")).toBeNull();
});

it("asks without a position for the Borås fallback and calls them popular", async () => {
  mockLocation = { data: { latitude: 57.721, longitude: 12.94, isFallback: true }, isPending: false };
  mockGetAreas.mockResolvedValue([area("rya", "Rya åsar", null)]);
  await renderWithProviders(<NearbyAreas />);
  await flushUntil(() => screen.queryByTestId("home-areas"));

  expect(mockGetAreas.mock.calls).toEqual([[undefined, undefined]]);
  expect(screen.getByText("Populära utflyktsmål")).toBeTruthy();
});

it("opens a destination and the whole list", async () => {
  mockGetAreas.mockResolvedValue([area("rya", "Rya åsar", 2.3)]);
  await renderWithProviders(<NearbyAreas />);
  await flushUntil(() => screen.queryByTestId("home-area-rya"));

  await fireEvent.press(screen.getByTestId("home-area-rya"));
  await fireEvent.press(screen.getByTestId("home-areas-see-all"));

  expect(mockNavigate).toHaveBeenNthCalledWith(1, {
    pathname: "/(tabs)/(home)/area/[identifier]",
    params: { identifier: "rya" },
  });
  expect(mockNavigate).toHaveBeenNthCalledWith(2, "/(tabs)/(home)/area/area-list-screen");
});

it("marks an example picture on a tile", async () => {
  mockGetAreas.mockResolvedValue([{ ...area("rya", "Rya åsar", 2.3), imageUrl: "https://media.example/mock/rya.jpg" }]);
  await renderWithProviders(<NearbyAreas />);
  await flushUntil(() => screen.queryByTestId("home-area-rya"));

  expect(within(screen.getByTestId("home-area-rya")).getByTestId("example-image-overlay")).toBeTruthy();
});

it("waits for the position before asking", async () => {
  mockLocation = { isPending: true };
  mockGetAreas.mockResolvedValue([]);
  await renderWithProviders(<NearbyAreas />);
  await settle();

  expect(mockGetAreas).not.toHaveBeenCalled();
  expect(screen.queryByTestId("home-areas")).toBeNull();
});

it("offers a retry when the destinations cannot be loaded", async () => {
  mockGetAreas.mockRejectedValue(new Error("down"));
  await renderWithProviders(<NearbyAreas />);
  await flushUntil(() => screen.queryByTestId("home-areas-error"));

  expect(screen.getByText("Kunde inte hämta utflyktsmålen just nu.")).toBeTruthy();
});
