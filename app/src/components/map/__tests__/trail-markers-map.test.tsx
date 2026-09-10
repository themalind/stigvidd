// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import TrailMarkersMap from "@/components/map/trail-markers-map";
import { FacilityType, MapMarkerFilter } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { cameraHandles, resetMapHandles, sourceHandle } from "@/test/maplibre";
import { renderWithProviders } from "@/test/render";
import type { CameraRef } from "@maplibre/maplibre-react-native";
import { fireEvent, screen } from "@testing-library/react-native";
import { createRef } from "react";

const mockGetTrailMarkers = jest.fn();
const mockGetFacilityMarkers = jest.fn();
const mockUseUserLocation = jest.fn();

jest.mock("@/api/map-markers", () => ({
  getTrailMarkers: () => mockGetTrailMarkers(),
  getFacilityMarkers: () => mockGetFacilityMarkers(),
}));

jest.mock("@/hooks/useUserLocation", () => ({
  useUserLocation: () => mockUseUserLocation(),
}));

const onClusterOpen = jest.fn();
const onMapPress = jest.fn();

const ALL_OFF: MapMarkerFilter = { trails: false, shelters: false, firePits: false, accessibility: false };

function trailMarker(identifier: string, isAccessible = true) {
  return { identifier, name: `Led ${identifier}`, isAccessible, startLatitude: 57.72, startLongitude: 12.94 };
}

function facilityMarker(name: string, facilityType: number, isAccessible = true) {
  return { identifier: `f-${name}`, name, facilityType, isAccessible, latitude: 57.72, longitude: 12.94 };
}

// A press on a clustered source carries the cluster's counters; a single marker arrives without them.
function clusterFeature(pointCount: number, clusterId = 7) {
  return {
    nativeEvent: {
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [12.94, 57.72] },
          properties: { point_count: pointCount, cluster_id: clusterId },
        },
      ],
    },
    stopPropagation: () => {},
  };
}

function pointFeature(properties: Record<string, unknown>) {
  return {
    nativeEvent: {
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [12.94, 57.72] },
          properties,
        },
      ],
    },
    stopPropagation: () => {},
  };
}

function source(id: string) {
  return screen.queryAllByTestId("maplibre-GeoJSONSource").find((node) => node.props.id === id);
}

async function show(filter: Partial<MapMarkerFilter> = {}, props: Record<string, unknown> = {}) {
  const cameraRef = createRef<CameraRef>();
  const rendered = renderWithProviders(
    <TrailMarkersMap
      filter={{ ...ALL_OFF, trails: true, ...filter }}
      cameraRef={cameraRef}
      onClusterOpen={onClusterOpen}
      onMapPress={onMapPress}
      {...props}
    />,
  );
  await flushUntil(() => screen.queryByTestId("maplibre-Map"));
  await settle();
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetMapHandles();
  mockGetTrailMarkers.mockResolvedValue([trailMarker("t1"), trailMarker("t2", false)]);
  mockGetFacilityMarkers.mockResolvedValue([
    facilityMarker("Grillplatsen", FacilityType.FirePit),
    facilityMarker("Vindskyddet", FacilityType.Shelter, false),
  ]);
  mockUseUserLocation.mockReturnValue({ data: { isFallback: true } });
});

// Each filter owns its own source, so a layer left on with the filter off is an unexplained pin.
it("mounts a source only for the kinds the filter asks for", async () => {
  const { unmount } = await show({ trails: true, firePits: false, shelters: false });
  expect(source("trails")).toBeTruthy();
  expect(source("firepits")).toBeFalsy();
  expect(source("shelters")).toBeFalsy();
  unmount();

  await show({ trails: false, firePits: true, shelters: true });
  expect(source("trails")).toBeFalsy();
  expect(source("firepits")).toBeTruthy();
  expect(source("shelters")).toBeTruthy();
});

// The accessibility filter applies across every kind at once.
it("drops what is not accessible from every source when that filter is on", async () => {
  const { unmount } = await show({ trails: true, firePits: true, shelters: true });
  // Both marker fetches have to land before the sources hold anything.
  await flushUntil(() => source("trails")?.props.data.features.length);
  expect(source("trails")?.props.data.features).toHaveLength(2);
  expect(source("shelters")?.props.data.features).toHaveLength(1);
  unmount();

  await show({ trails: true, firePits: true, shelters: true, accessibility: true });
  await flushUntil(() => source("trails")?.props.data.features.length);
  expect(source("trails")?.props.data.features).toHaveLength(1);
  expect(source("firepits")?.props.data.features).toHaveLength(1);
  expect(source("shelters")?.props.data.features).toHaveLength(0);
});

// A small cluster will not separate usefully, so it opens the carousel; a big one zooms in.
it("opens a small cluster as a carousel and zooms a large one", async () => {
  await show();
  sourceHandle("trails").getClusterExpansionZoom.mockResolvedValue(12);
  sourceHandle("trails").getClusterLeaves.mockResolvedValue([
    { properties: { identifier: "t1" } },
    { properties: { identifier: "t2" } },
  ]);

  fireEvent(source("trails")!, "press", clusterFeature(3));
  await settle();

  expect(onClusterOpen).toHaveBeenCalledWith(["t1", "t2"], { coordinate: [12.94, 57.72], radius: 16 }, 12);

  onClusterOpen.mockClear();
  fireEvent(source("trails")!, "press", clusterFeature(40));
  await settle();

  expect(onClusterOpen).not.toHaveBeenCalled();
  expect(cameraHandles().at(-1)!.flyTo).toHaveBeenCalledWith(
    expect.objectContaining({ center: [12.94, 57.72], zoom: 12 }),
  );
});

// A cluster that cannot break apart further opens whatever its size, or the trails inside are unreachable.
it("opens a large cluster that cannot be zoomed apart", async () => {
  await show();
  // Past clusterMaxZoom: zooming would not separate these.
  sourceHandle("trails").getClusterExpansionZoom.mockResolvedValue(18);
  sourceHandle("trails").getClusterLeaves.mockResolvedValue([{ properties: { identifier: "t1" } }]);

  fireEvent(source("trails")!, "press", clusterFeature(40));
  await settle();

  expect(onClusterOpen).toHaveBeenCalledWith(["t1"], { coordinate: [12.94, 57.72], radius: 20 }, 18);
});

it("opens a single trail straight into its own carousel", async () => {
  await show();

  fireEvent(source("trails")!, "press", pointFeature({ identifier: "t1" }));
  await settle();

  expect(onClusterOpen).toHaveBeenCalledWith(["t1"], { coordinate: [12.94, 57.72], radius: 9 });
});

// Facilities have no detail screen: a cluster zooms, and a single pin names itself.
it("zooms a facility cluster and names a single facility", async () => {
  await show({ firePits: true });
  sourceHandle("firepits").getClusterExpansionZoom.mockResolvedValue(14);

  fireEvent(source("firepits")!, "press", clusterFeature(4));
  await settle();
  expect(cameraHandles().at(-1)!.flyTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 14 }));
  expect(onClusterOpen).not.toHaveBeenCalled();

  fireEvent(source("firepits")!, "press", pointFeature({ name: "Grillplatsen", isAccessible: true }));
  await settle();
  expect(screen.getByText("Grillplatsen")).toBeTruthy();
});

// The bubble hangs over the pin, so it goes when the pin does.
it("takes the name bubble down with the pin it belongs to", async () => {
  const { rerender } = await show({ firePits: true });

  fireEvent(source("firepits")!, "press", pointFeature({ name: "Grillplatsen", isAccessible: true }));
  await settle();
  expect(screen.getByText("Grillplatsen")).toBeTruthy();

  rerender(
    <TrailMarkersMap
      filter={{ ...ALL_OFF, trails: true, firePits: false }}
      cameraRef={createRef<CameraRef>()}
      onClusterOpen={onClusterOpen}
      onMapPress={onMapPress}
    />,
  );

  expect(screen.queryByText("Grillplatsen")).toBeNull();
});

it("clears the bubble when the map itself is pressed", async () => {
  await show({ firePits: true });

  fireEvent(source("firepits")!, "press", pointFeature({ name: "Grillplatsen", isAccessible: true }));
  await settle();
  fireEvent(screen.getByTestId("maplibre-Map"), "press");

  expect(screen.queryByText("Grillplatsen")).toBeNull();
  expect(onMapPress).toHaveBeenCalled();
});

// A failed marker fetch keeps the map as it is; the failure goes to the snackbar.
it("reports a failed fetch without taking the map down", async () => {
  mockGetTrailMarkers.mockRejectedValue(new Error("500"));
  const { store } = await show();

  await flushUntil(() => store.get(snackbarAtom).visible);

  expect(store.get(snackbarAtom)).toMatchObject({ type: "error" });
  expect(screen.getByTestId("maplibre-Map")).toBeTruthy();
});

// The ring is the tapped marker's own radius plus a fixed gap, for a single point and a cluster alike.
it("rings the highlighted marker just outside its own edge", async () => {
  await show({}, { highlight: { coordinate: [12.94, 57.72], radius: 26 } });

  const ring = screen.queryAllByTestId("maplibre-GeoJSONSource").find((node) => node.props.id === "trail-highlight");
  expect(ring?.props.data.features[0].properties).toEqual({ radius: 31 });
});
