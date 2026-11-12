// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AreaMapScreen from "@/components/area/area-map-screen";
import { CityArea, FacilityType } from "@/data/types";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const maplibre = jest.requireMock("@maplibre/maplibre-react-native");
const mockGetArea = jest.fn();
const mockBack = jest.fn();
const mockUseLiveUserLocation = jest.fn();

jest.mock("@/api/areas", () => ({
  getAreaByIdentifier: (...args: unknown[]) => mockGetArea(...args),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ identifier: "kypesjon" }),
  useRouter: () => ({ back: mockBack, navigate: jest.fn() }),
}));

jest.mock("@/hooks/location/useLiveUserLocation", () => ({
  useLiveUserLocation: () => mockUseLiveUserLocation(),
}));

const AREA: CityArea = {
  identifier: "kypesjon",
  name: "Kypesjön",
  location: "",
  boundary: [
    [
      [
        [12.9, 57.7],
        [13.0, 57.7],
        [13.0, 57.8],
        [12.9, 57.7],
      ],
    ],
  ],
  trails: [
    {
      identifier: "t",
      name: "Runt sjön",
      trailLength: 3,
      classification: 1,
      averageRating: 0,
      path: [
        [12.95, 57.72],
        [12.97, 57.74],
      ],
    },
  ],
  facilities: [
    {
      identifier: "bad",
      name: "",
      facilityType: FacilityType.SwimmingArea,
      isAccessible: false,
      latitude: 57.71,
      longitude: 12.93,
    },
  ],
};

function source(id: string) {
  return screen.queryAllByTestId("maplibre-GeoJSONSource").find((node) => node.props.id === id);
}

async function show(area: CityArea = AREA) {
  mockGetArea.mockResolvedValue(area);
  await renderWithProviders(<AreaMapScreen />);
  await flushUntil(() => screen.queryByText(area.name));
}

beforeEach(() => {
  jest.clearAllMocks();
  maplibre.resetHandles();
  mockUseLiveUserLocation.mockReturnValue(null);
});

it("draws the area named in the route with its name on the back chip", async () => {
  await show();

  expect(mockGetArea).toHaveBeenCalledWith("kypesjon");
  expect(source("area-boundary")?.props.data.features).toHaveLength(1);
  expect(source("area-trails")?.props.data.features).toHaveLength(1);
  expect(screen.getByText("1 badplats")).toBeTruthy();

  fireEvent.press(screen.getByRole("button", { name: "Gå tillbaka" }));
  expect(mockBack).toHaveBeenCalled();
});

it("frames the area once both the map and the area are there", async () => {
  await show();

  await act(async () => {
    screen.getByTestId("maplibre-Map").props.onDidFinishLoadingMap();
  });

  expect(maplibre.handlesFor("Camera").at(-1).fitBounds).toHaveBeenCalledWith(
    [12.9, 57.7, 13.0, 57.8],
    expect.objectContaining({ duration: 0 }),
  );
});

it("puts the user's position above the area", async () => {
  mockUseLiveUserLocation.mockReturnValue({ position: [12.94, 57.73], heading: null });
  await show();

  const halo = screen.queryAllByTestId("maplibre-Layer").find((node) => node.props.id === "area-user-halo");
  expect(halo?.props.afterId).toBe("area-facilities-dots");
});

it("says so when the area could not be loaded", async () => {
  mockGetArea.mockRejectedValue(new Error("network"));
  await renderWithProviders(<AreaMapScreen />);
  await flushUntil(() => screen.queryByText("Kunde inte ladda kartdata"));

  expect(screen.getByText("Kunde inte ladda kartdata")).toBeTruthy();
});
