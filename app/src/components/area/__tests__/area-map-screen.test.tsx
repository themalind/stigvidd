// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AreaMapScreen from "@/components/area/area-map-screen";
import { HOME_AREA_ROUTES } from "@/components/area/area-routes";
import { CityArea, FacilityType } from "@/data/types";
import { flushUntil } from "@/test/flush";
import { cameraHandles, sourceHandle } from "@/test/maplibre";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const maplibre = jest.requireMock("@maplibre/maplibre-react-native");
const mockGetArea = jest.fn();
const mockBack = jest.fn();
const mockUseLiveUserLocation = jest.fn();

jest.mock("@/api/areas", () => ({
  getAreaByIdentifier: (...args: unknown[]) => mockGetArea(...args),
}));

const mockNavigate = jest.fn();
const mockGetTrailCards = jest.fn();

jest.mock("@/api/trails", () => ({
  getTrailCards: (...args: unknown[]) => mockGetTrailCards(...args),
}));

let mockParams: { identifier: string; focus?: string } = { identifier: "kypesjon" };

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, navigate: mockNavigate }),
}));

let clock = 5_000_000;

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
  await renderWithProviders(<AreaMapScreen routes={HOME_AREA_ROUTES} />);
  await flushUntil(() => screen.queryByText(area.name));
}

function press(features: { identifier?: string; name?: string; coordinates?: [number, number] }[]) {
  return {
    nativeEvent: {
      features: features.map(({ coordinates = [12.95, 57.72], ...properties }) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties,
      })),
    },
    stopPropagation: () => {},
  };
}

function card(identifier: string, name: string) {
  return { identifier, name, trailLength: 3, classification: 1, isAccessible: false, averageRating: 0 };
}

beforeEach(() => {
  jest.clearAllMocks();
  maplibre.resetHandles();
  mockParams = { identifier: "kypesjon" };
  mockUseLiveUserLocation.mockReturnValue(null);
  mockGetTrailCards.mockResolvedValue([card("t", "Runt sjön"), card("u", "Kortslingan")]);
  // keep-comment: guardedNavigate debounces on module state, so the clock only ever moves on
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("marks each trail at its start, as on the map tab", async () => {
  await show();

  const trails = source("area-trails")?.props.data.features;
  expect(trails).toEqual([
    expect.objectContaining({
      properties: { identifier: "t", isAccessible: false },
      geometry: { type: "Point", coordinates: [12.95, 57.72] },
    }),
  ]);
  expect(
    screen
      .queryAllByTestId("maplibre-Layer")
      .some((node) => node.props.type === "line" && node.props.id.startsWith("area-trails")),
  ).toBe(false);
});

it("opens the trail card on a tapped trail and goes on to the trail", async () => {
  await show();

  await act(async () => {
    source("area-trails")?.props.onPress(press([{ identifier: "t" }]));
  });
  await flushUntil(() => screen.queryByText("Runt sjön"));

  expect(mockGetTrailCards).toHaveBeenCalledWith(["t"]);
  expect(screen.queryByTestId("area-map-legend")).toBeNull();

  await fireEvent.press(screen.getAllByText("Läs mer")[0]);
  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: "/(tabs)/(home)/trail/[identifier]",
    params: { identifier: "t" },
  });
});

it("opens every trail that starts where the finger lands", async () => {
  await show();

  await act(async () => {
    source("area-trails")?.props.onPress(press([{ identifier: "t" }, { identifier: "u" }, { identifier: "t" }]));
  });
  await flushUntil(() => screen.queryByText("Kortslingan"));

  expect(screen.getByText("Runt sjön")).toBeTruthy();
  expect(screen.getByText("1/2")).toBeTruthy();
  expect(screen.queryByText("1/3")).toBeNull();
});

it("shows a tapped place's name, and a tap on the map clears it", async () => {
  await show();

  await act(async () => {
    source("area-swimming")?.props.onPress(press([{ name: "Kypebadet", coordinates: [12.93, 57.71] }]));
  });

  expect(screen.getByTestId("map-name-bubble")).toHaveTextContent("Kypebadet");

  await act(async () => {
    screen.getByTestId("maplibre-Map").props.onPress();
  });

  expect(screen.queryByTestId("map-name-bubble")).toBeNull();
  expect(screen.getByTestId("area-map-legend")).toBeTruthy();
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
  expect(halo?.props.afterId).toBe("area-shelter-points");
});

function clusterPress(pointCount: number, coordinates: [number, number] = [12.95, 57.72]) {
  return {
    nativeEvent: {
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates },
          properties: { point_count: pointCount, cluster_id: 7 },
        },
      ],
    },
    stopPropagation: () => {},
  };
}

// keep-comment: trails sharing a trailhead cluster into one marker, which opens them all in the carousel
it("opens the trails of a small cluster together", async () => {
  await show();
  sourceHandle("area-trails").getClusterExpansionZoom.mockResolvedValue(15);
  sourceHandle("area-trails").getClusterLeaves.mockResolvedValue([
    { properties: { identifier: "t" } },
    { properties: { identifier: "u" } },
  ]);

  await act(async () => {
    await source("area-trails")?.props.onPress(clusterPress(2));
  });
  await flushUntil(() => screen.queryByText("Kortslingan"));

  expect(sourceHandle("area-trails").getClusterLeaves).toHaveBeenCalledWith(7, 2, 0);
  expect(screen.getByText("1/2")).toBeTruthy();
});

it("zooms into a large cluster that breaks apart", async () => {
  await show();
  sourceHandle("area-trails").getClusterExpansionZoom.mockResolvedValue(13);

  await act(async () => {
    await source("area-trails")?.props.onPress(clusterPress(12));
  });

  expect(sourceHandle("area-trails").getClusterLeaves).not.toHaveBeenCalled();
  expect(cameraHandles().at(-1)?.flyTo).toHaveBeenCalledWith({ center: [12.95, 57.72], zoom: 13, duration: 500 });
});

it("zooms into a cluster of facilities", async () => {
  await show();
  sourceHandle("area-swimming").getClusterExpansionZoom.mockResolvedValue(14);

  await act(async () => {
    await source("area-swimming")?.props.onPress(clusterPress(3, [12.93, 57.71]));
  });

  expect(cameraHandles().at(-1)?.flyTo).toHaveBeenCalledWith({ center: [12.93, 57.71], zoom: 14, duration: 500 });
});

// keep-comment: places on one spot never break apart, so zooming would leave all but one unreachable
it("names every place in a cluster that cannot be zoomed apart", async () => {
  await show();
  sourceHandle("area-swimming").getClusterExpansionZoom.mockResolvedValue(18);
  sourceHandle("area-swimming").getClusterLeaves.mockResolvedValue([
    { properties: { name: "Kypebadet" } },
    { properties: { name: "Kypebadet norra" } },
  ]);

  await act(async () => {
    await source("area-swimming")?.props.onPress(clusterPress(2, [12.93, 57.71]));
  });

  expect(cameraHandles().at(-1)?.flyTo).not.toHaveBeenCalled();
  expect(screen.getByTestId("map-name-bubble")).toHaveTextContent("Kypebadet\nKypebadet norra");
});

// keep-comment: imported places can lack a name, and a tap on them must still say what is there
it("counts the unnamed places in a cluster that cannot be zoomed apart", async () => {
  await show();
  sourceHandle("area-swimming").getClusterExpansionZoom.mockResolvedValue(18);
  sourceHandle("area-swimming").getClusterLeaves.mockResolvedValue([
    { properties: { name: "Kypebadet" } },
    { properties: { name: "" } },
    { properties: {} },
  ]);

  await act(async () => {
    await source("area-swimming")?.props.onPress(clusterPress(3, [12.93, 57.71]));
  });

  expect(screen.getByTestId("map-name-bubble")).toHaveTextContent("Kypebadet\n2 badplatser");
});

// keep-comment: a counted row's link shows which of its own kind are accessible, not every accessible place in the area
it("frames only the accessible places of the asked kind", async () => {
  mockParams = { identifier: "kypesjon", focus: "firePit" };
  await show({
    ...AREA,
    facilities: [
      { ...AREA.facilities[0], identifier: "g", facilityType: FacilityType.FirePit, isAccessible: true },
      {
        ...AREA.facilities[0],
        identifier: "v",
        facilityType: FacilityType.Shelter,
        isAccessible: true,
        latitude: 57.8,
      },
      { ...AREA.facilities[0], identifier: "g2", facilityType: FacilityType.FirePit, latitude: 57.79 },
    ],
  });

  await act(async () => {
    screen.getByTestId("maplibre-Map").props.onDidFinishLoadingMap();
  });

  const [bounds] = cameraHandles().at(-1)?.fitBounds.mock.calls.at(-1) ?? [];
  expect(bounds[0]).toBeCloseTo(12.928);
  expect(bounds[1]).toBeCloseTo(57.708);
  expect(bounds[2]).toBeCloseTo(12.932);
  expect(bounds[3]).toBeCloseTo(57.712);
});

it("says so when the area could not be loaded", async () => {
  mockGetArea.mockRejectedValue(new Error("network"));
  await renderWithProviders(<AreaMapScreen routes={HOME_AREA_ROUTES} />);
  await flushUntil(() => screen.queryByText("Kunde inte ladda kartdata"));

  expect(screen.getByText("Kunde inte ladda kartdata")).toBeTruthy();
});
