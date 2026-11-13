// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AreaMap from "@/components/area/area-map";
import { MARKER_COLORS, ROUTE_LINE_COLOR, SWIMMING_MARKER_COLORS } from "@/components/map/marker-styles";
import { AppDarkTheme } from "@/constants/theme";
import { CityArea, FacilityType } from "@/data/types";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const maplibre = jest.requireMock("@maplibre/maplibre-react-native");

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
    {
      identifier: "g1",
      name: "",
      facilityType: FacilityType.FirePit,
      isAccessible: false,
      latitude: 57.72,
      longitude: 12.94,
    },
    {
      identifier: "g2",
      name: "",
      facilityType: FacilityType.FirePit,
      isAccessible: false,
      latitude: 57.73,
      longitude: 12.95,
    },
    {
      identifier: "v",
      name: "",
      facilityType: FacilityType.Shelter,
      isAccessible: false,
      latitude: 57.74,
      longitude: 12.96,
    },
  ],
};

function layer(id: string) {
  return screen.queryAllByTestId("maplibre-Layer").find((node) => node.props.id === id);
}

function source(id: string) {
  return screen.queryAllByTestId("maplibre-GeoJSONSource").find((node) => node.props.id === id);
}

beforeEach(() => {
  maplibre.resetHandles();
});

it("draws the boundary, the trails and a dot per facility", async () => {
  await renderWithProviders(<AreaMap area={AREA} onOpen={jest.fn()} />);

  expect(source("area-boundary")?.props.data.features).toHaveLength(1);
  expect(source("area-trails")?.props.data.features).toHaveLength(1);
  expect(source("area-swimming")?.props.data.features).toHaveLength(1);
  expect(source("area-firePit")?.props.data.features).toHaveLength(2);
  expect(source("area-shelter")?.props.data.features).toHaveLength(1);
  expect(layer("area-swimming-points")?.props.paint["circle-color"]).toBe(SWIMMING_MARKER_COLORS.fill);
  expect(layer("area-firePit-points")?.props.paint["circle-color"]).toBe(MARKER_COLORS.firePits.fill);
  expect(layer("area-shelter-points")?.props.paint["circle-color"]).toBe(MARKER_COLORS.shelters.fill);
});

// keep-comment: trailheads that share a start, and facilities side by side, would otherwise stack into one untappable dot
it("clusters the trails and every kind of facility", async () => {
  await renderWithProviders(<AreaMap area={AREA} onOpen={jest.fn()} />);

  for (const id of ["area-trails", "area-swimming", "area-firePit", "area-shelter"]) {
    expect(source(id)?.props.cluster).toBe(true);
    expect(layer(`${id}-cluster-count`)).toBeTruthy();
  }
});

it("counts what is on the map in the legend", async () => {
  await renderWithProviders(<AreaMap area={AREA} onOpen={jest.fn()} />);

  expect(screen.getByText("1 led")).toBeTruthy();
  expect(screen.getByText("1 badplats")).toBeTruthy();
  expect(screen.getByText("2 grillplatser")).toBeTruthy();
  expect(screen.getByText("1 vindskydd")).toBeTruthy();
});

it("frames everything once the map has loaded", async () => {
  await renderWithProviders(<AreaMap area={AREA} onOpen={jest.fn()} />);

  await act(async () => {
    screen.getByTestId("maplibre-Map").props.onDidFinishLoadingMap();
  });

  expect(maplibre.handlesFor("Camera").at(-1).fitBounds).toHaveBeenCalledWith(
    [12.9, 57.7, 13.0, 57.8],
    expect.objectContaining({ duration: 0 }),
  );
});

it("opens the full map from the badge", async () => {
  const onOpen = jest.fn();
  await renderWithProviders(<AreaMap area={AREA} onOpen={onOpen} />);

  fireEvent.press(screen.getByRole("button", { name: "Öppna karta" }));

  expect(onOpen).toHaveBeenCalledTimes(1);
});

it("keeps the light map colours in the dark theme", async () => {
  await renderWithProviders(<AreaMap area={AREA} onOpen={jest.fn()} />, { theme: AppDarkTheme });

  expect(layer("area-boundary-line")?.props.paint["line-color"]).toBe(ROUTE_LINE_COLOR);
});

it("draws nothing when the area has nothing with a position", async () => {
  await renderWithProviders(
    <AreaMap area={{ ...AREA, boundary: null, trails: [], facilities: [] }} onOpen={jest.fn()} />,
  );

  expect(screen.queryByTestId("area-map")).toBeNull();
});
