// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ROUTE_LINE_COLOR } from "@/components/map/marker-styles";
import RoutePreviewMap from "@/components/map/route-preview-map";
import { SCREEN_PADDING } from "@/constants/constants";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

// The camera is driven through an imperative handle, so its moves show on the mock's handle.
const maplibre = jest.requireMock("@maplibre/maplibre-react-native");

const PATH: GeoJSON.Position[] = [
  [12.94, 57.72],
  [12.96, 57.71],
  [12.95, 57.74],
];

const onOpen = jest.fn();
let alert: jest.SpyInstance;
let openURL: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  maplibre.resetHandles();
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
});

afterEach(() => {
  alert.mockRestore();
  openURL.mockRestore();
});

function show(props: Partial<React.ComponentProps<typeof RoutePreviewMap>> = {}) {
  return renderWithProviders(<RoutePreviewMap idPrefix="hike" path={PATH} {...props} />);
}

function map() {
  return screen.getByTestId("maplibre-Map");
}

function camera() {
  return maplibre.handlesFor("Camera").at(-1);
}

// Every marker mounts layers of its own, so a layer is found by the id its owner gave it.
function layer(id: string) {
  return screen.queryAllByTestId("maplibre-Layer").find((node) => node.props.id === id);
}

function source(id: string) {
  return screen.queryAllByTestId("maplibre-GeoJSONSource").find((node) => node.props.id === id);
}

// The map reports itself ready once the style has loaded, which is when the camera can be moved.
async function mapLoaded() {
  await act(async () => {
    map().props.onDidFinishLoadingMap();
  });
}

it("draws the recorded walk as a line through every point", () => {
  show();

  expect(source("hike-route")?.props.data).toEqual({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: PATH },
  });
  expect(layer("hike-route-line")?.props.type).toBe("line");
});

it("draws the line in the route colour, rounded at its joins and ends", () => {
  show();

  expect(layer("hike-route-line")?.props.paint).toEqual({ "line-color": ROUTE_LINE_COLOR, "line-width": 3 });
  expect(layer("hike-route-line")?.props.layout).toEqual({ "line-join": "round", "line-cap": "round" });
});

it("marks the start of the walk", () => {
  show();

  expect(source("hike-start")?.props.data.geometry.coordinates).toEqual(PATH[0]);
  expect(layer("hike-start-label")?.props.layout["text-field"]).toBe("Start");
});

// MapLibre keys sources and layers by id, so two previews on one screen need distinct prefixes.
it("keeps each preview's sources and layers under its own prefix", () => {
  show({ idPrefix: "delad-tur" });

  expect(source("delad-tur-route")).toBeTruthy();
  expect(source("delad-tur-start")).toBeTruthy();
  expect(layer("delad-tur-route-line")).toBeTruthy();
  expect(source("hike-route")).toBeFalsy();
});

// A route still loading has no coordinates, and an empty line would put an empty source on the map.
it("draws no map at all for a route with no points", () => {
  show({ path: [], onOpen });

  expect(screen.queryByTestId("maplibre-Map")).toBeNull();
  expect(screen.queryByLabelText("Visa kartvy")).toBeNull();
});

// One point is a real walk — a recording with a single fix — and it has a trailhead but no line.
it("marks the start of a one-point walk without drawing a line", () => {
  show({ path: [PATH[0]] });

  expect(source("hike-route")).toBeFalsy();
  expect(source("hike-start")).toBeTruthy();
});

it("fits the whole walk on screen once the map is ready", async () => {
  show();

  await mapLoaded();

  expect(camera().fitBounds).toHaveBeenCalledWith([12.94, 57.71, 12.96, 57.74], {
    padding: { top: 20, right: 20, bottom: 20, left: 20 },
    duration: 0,
  });
});

// A single point has a zero-area bounding box, which fitBounds resolves to maximum zoom.
it("centres a one-point walk at a readable zoom instead of fitting it", async () => {
  show({ path: [PATH[0]] });

  await mapLoaded();

  expect(camera().jumpTo).toHaveBeenCalledWith({ center: PATH[0], zoom: 15 });
  expect(camera().fitBounds).not.toHaveBeenCalled();
});

it("waits for the map before moving the camera", () => {
  show();

  expect(camera().fitBounds).not.toHaveBeenCalled();
  expect(camera().jumpTo).not.toHaveBeenCalled();
});

it("leaves the live position to the fullscreen view", () => {
  show();

  expect(screen.queryByTestId("maplibre-UserLocation")).toBeNull();
});

// The bottom corners hold the overlay's pills, and a card has no safe-area inset to clear.
it("moves the map's attribution out of the pills' corners", () => {
  show();

  expect(map().props.attribution).toBe(true);
  expect(map().props.attributionPosition).toEqual({ top: SCREEN_PADDING, left: SCREEN_PADDING });
});

// A preview that is a button cannot also be panned: the full-cover Pressable swallows the drag.
it("stops the map being panned once it is a button", () => {
  show({ onOpen });

  expect(map().props).toMatchObject({
    dragPan: false,
    touchZoom: false,
    touchRotate: false,
    touchPitch: false,
    doubleTapZoom: false,
  });
});

it("leaves a preview with nothing to open pannable", () => {
  show();

  expect(map().props.dragPan).toBeUndefined();
  expect(map().props.doubleTapZoom).toBeUndefined();
});

it("opens the fullscreen view when the preview is pressed", async () => {
  show({ onOpen });

  fireEvent.press(screen.getByLabelText("Visa kartvy"));
  await settle();

  expect(onOpen).toHaveBeenCalledTimes(1);
});

it("says on the badge what the press will open", () => {
  show({ onOpen, label: "Visa turen" });

  expect(screen.getByText("Visa turen")).toBeTruthy();
  expect(screen.queryByText("Visa kartvy")).toBeNull();
});

it("shows no badge on a preview that opens nothing", () => {
  show();

  expect(screen.queryByText("Visa kartvy")).toBeNull();
  expect(screen.queryByLabelText("Vägbeskrivning")).toBeNull();
});

// The map swallows touches, so the cover is what lets the whole surface take the tap.
it("covers a badgeless preview with a button of its own", async () => {
  show({ onOpen, showBadge: false });

  expect(screen.queryByText("Visa kartvy")).toBeNull();
  const cover = screen.getByTestId("route-preview-cover");
  expect(cover).toHaveStyle({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 });
  expect(cover.props.accessibilityRole).toBe("button");

  fireEvent.press(cover);
  await settle();

  expect(onOpen).toHaveBeenCalledTimes(1);
});

it("offers directions to the start of the walk", async () => {
  show({ onOpen });

  fireEvent.press(screen.getByLabelText("Vägbeskrivning"));
  await settle();

  expect(alert).toHaveBeenCalledWith(
    "Vägbeskrivning",
    "Vill du öppna vägbeskrivning till ledens start i din kartapp?",
    expect.any(Array),
  );
});

// Longitude comes first in a GeoJSON position and last in a maps url, so the pair is swapped.
it("sends the maps app the start point, latitude first", async () => {
  show({ onOpen });

  fireEvent.press(screen.getByLabelText("Vägbeskrivning"));
  const [, , buttons] = alert.mock.calls[0];
  await act(async () => {
    buttons.at(-1).onPress();
  });

  expect(openURL).toHaveBeenCalledWith(expect.stringContaining("57.72,12.94"));
});

// The home screen's card is too small for a second pill, and directions are not what it is for.
it("leaves out the directions pill where there is no room for it", () => {
  show({ onOpen, showDirections: false });

  expect(screen.queryByLabelText("Vägbeskrivning")).toBeNull();
  expect(screen.getByLabelText("Visa kartvy")).toBeTruthy();
});

// Without the overlay there is no pill, so the marker carries the tap; with it, the cover would swallow it.
it("makes the start marker itself tappable only when nothing covers it", () => {
  show();
  expect(layer("hike-start-hit")).toBeTruthy();

  screen.unmount();
  show({ onOpen });

  expect(layer("hike-start-hit")).toBeFalsy();
});

it("opens directions to the start from the marker itself when there is no pill", async () => {
  show();

  fireEvent(source("hike-start")!, "press");
  await settle();
  const [, , buttons] = alert.mock.calls[0];
  await act(async () => {
    buttons.at(-1).onPress();
  });

  expect(alert).toHaveBeenCalledWith("Vägbeskrivning", expect.any(String), expect.any(Array));
  expect(openURL).toHaveBeenCalledWith(expect.stringContaining("57.72,12.94"));
});

it("lets the map fill the frame the caller gives it", () => {
  show({ style: { height: 180, borderRadius: 12 } });

  expect(screen.getByTestId("route-preview")).toHaveStyle({ height: 180, borderRadius: 12 });
  expect(map()).toHaveStyle({ flex: 1 });
});
