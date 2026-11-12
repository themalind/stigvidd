// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { CityArea, FacilityType } from "@/data/types";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import AreaListScreen from "../area/area-list-screen";

const mockGetAreas = jest.fn();
jest.mock("@/api/areas", () => ({ getAreas: (...args: unknown[]) => mockGetAreas(...args) }));

let mockLocation: { data?: { latitude: number; longitude: number; isFallback: boolean }; isPending: boolean };
jest.mock("@/hooks/location/useUserLocation", () => ({ useUserLocation: () => mockLocation }));

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args), back: jest.fn() },
  useRouter: () => ({ navigate: mockNavigate, back: jest.fn(), canGoBack: () => true }),
}));

let clock = 9_000_000;

function area(
  identifier: string,
  name: string,
  municipality: string,
  distanceKm: number | null,
  facilityType = 0,
): CityArea {
  return {
    identifier,
    name,
    location: "",
    municipality,
    distanceKm,
    facilities: facilityType ? [{ identifier: `f-${identifier}`, name: "", facilityType, isAccessible: false }] : [],
    trails: [],
  };
}

// keep-comment: the API's order, nearest first
const AREAS = [
  area("rya", "Rya åsar", "Borås", 2.3, FacilityType.Shelter),
  area("asunden", "Åsunden", "Ulricehamn", 27, FacilityType.SwimmingArea),
  area("almenas", "Almenäs", "Borås", 4.8, FacilityType.SwimmingArea),
];

function rows() {
  return screen.getAllByTestId(/^area-row-(?!distance)/).map((row) => row.props.testID.replace("area-row-", ""));
}

async function show() {
  await renderWithProviders(<AreaListScreen />);
  await flushUntil(() => screen.queryByTestId("area-row-rya"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLocation = { data: { latitude: 57.721, longitude: 12.94, isFallback: false }, isPending: false };
  mockGetAreas.mockResolvedValue(AREAS);
  // keep-comment: guardedNavigate debounces on module state, so the clock only ever moves on
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("lists the destinations nearest first with their distance", async () => {
  await show();

  expect(mockGetAreas).toHaveBeenCalledWith(57.72, 12.94);
  expect(rows()).toEqual(["rya", "asunden", "almenas"]);
  expect(screen.getByTestId("area-row-distance-rya")).toHaveTextContent("2,3 km");
  expect(screen.getByText("Närmast")).toBeTruthy();
});

it("groups A–Ö by municipality", async () => {
  await show();

  await fireEvent.press(screen.getByTestId("area-sort-az"));

  expect(rows()).toEqual(["almenas", "rya", "asunden"]);
  expect(screen.getByText("Borås · 2")).toBeTruthy();
  expect(screen.getByText("Ulricehamn · 1")).toBeTruthy();
});

it("narrows by search, municipality and feature, and says when nothing is left", async () => {
  await show();

  await fireEvent.changeText(screen.getByTestId("area-search"), "almenas");
  expect(rows()).toEqual(["almenas"]);

  await fireEvent.changeText(screen.getByTestId("area-search"), "");
  await fireEvent.press(screen.getByTestId("area-municipality"));
  await fireEvent.press(screen.getByTestId("area-municipality-Ulricehamn"));
  expect(rows()).toEqual(["asunden"]);

  await fireEvent.press(screen.getByTestId("area-feature-shelter"));
  expect(screen.queryAllByTestId(/^area-row-/)).toHaveLength(0);
  expect(screen.getByTestId("area-list-empty")).toBeTruthy();
});

it("calls the first sort popular without a position", async () => {
  mockLocation = { data: { latitude: 57.721, longitude: 12.94, isFallback: true }, isPending: false };
  await show();

  expect(mockGetAreas).toHaveBeenCalledWith(undefined, undefined);
  expect(screen.getByText("Populärast")).toBeTruthy();
});

it("keeps calling the kept popular list popular while the position's list loads", async () => {
  mockLocation = { data: { latitude: 57.721, longitude: 12.94, isFallback: true }, isPending: false };
  mockGetAreas.mockResolvedValue(AREAS.map((a) => ({ ...a, distanceKm: null })));
  const rendered = await renderWithProviders(<AreaListScreen />);
  await flushUntil(() => screen.queryByTestId("area-row-rya"));

  mockLocation = { data: { latitude: 57.721, longitude: 12.94, isFallback: false }, isPending: false };
  mockGetAreas.mockReturnValue(new Promise(() => {}));
  await act(async () => {
    rendered.rerender(<AreaListScreen />);
  });

  expect(mockGetAreas).toHaveBeenCalledWith(57.72, 12.94);
  expect(screen.getByTestId("area-row-rya")).toBeTruthy();
  expect(screen.getByText("Populärast")).toBeTruthy();
  expect(screen.queryByText("Närmast")).toBeNull();
});

it("opens a destination", async () => {
  await show();

  await fireEvent.press(screen.getByTestId("area-row-almenas"));

  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(home)/area/[identifier]",
    params: { identifier: "almenas" },
  });
});
