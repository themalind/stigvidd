// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailCreator from "@/components/trail/trail-creator/trail-creator";
import { START_COORDINATE_BORAS } from "@/constants/constants";
import { LocationData, Segment } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { cameraHandles, resetMapHandles } from "@/test/maplibre";
import { act, fireEvent, screen } from "@testing-library/react-native";

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockReset = jest.fn();
const mockGetActiveTime = jest.fn();
const mockShouldShowInfo = jest.fn();
const mockDismissInfo = jest.fn();
const mockLastKnown = jest.fn();
const mockCurrentPosition = jest.fn();

let mockTracking: ReturnType<typeof trackingState>;

jest.mock("@/services/use-location-tracking", () => ({
  useLocationTracking: () => mockTracking,
}));

jest.mock("@/services/location-task", () => ({
  shouldShowRecordingInfo: () => mockShouldShowInfo(),
  dismissRecordingInfo: () => mockDismissInfo(),
  INACTIVITY_MINUTES: 20,
  MAX_HOURS: 12,
}));

jest.mock("expo-location", () => ({
  getLastKnownPositionAsync: () => mockLastKnown(),
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
  Accuracy: { Balanced: 3 },
}));

jest.mock("@/api/hikes", () => ({ createHike: jest.fn() }));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me" } }) };
});

function point(index: number, timeStamp: number): LocationData {
  return { data: { latitude: 57.72 + index * 0.001, longitude: 12.94 }, timeStamp };
}

function segment(points: LocationData[]): Segment {
  return { coordinates: points, distance: 0, startTime: points[0]?.timeStamp ?? 0 };
}

function trackingState({
  isTracking = false,
  segments = [] as Segment[],
  currentSegment = undefined as Segment | undefined,
  liveCoordinates = [] as LocationData[],
  totalDistance = 0,
} = {}) {
  return {
    startTracking: mockStart,
    stopTracking: mockStop,
    resetTracking: mockReset,
    isTracking,
    hike: { segments, totalDistance, totalTime: 0 },
    currentSegment,
    liveCoordinates,
    getActiveTime: mockGetActiveTime,
  };
}

// The map only mounts once a centre is known, which arrives from a promise.
async function show() {
  const rendered = renderWithProviders(<TrailCreator />);
  await flushUntil(() => screen.queryByTestId("maplibre-Map"));
  return rendered;
}

function camera() {
  return cameraHandles().at(-1)!;
}

function routeLayer() {
  return screen.queryAllByTestId("maplibre-Layer").find((node) => node.props.id === "hike-route-line");
}

function routePositions() {
  const source = screen.queryAllByTestId("maplibre-GeoJSONSource").find((node) => node.props.id === "hike-route");
  return source?.props.data.geometry.coordinates ?? [];
}

beforeEach(() => {
  jest.clearAllMocks();
  resetMapHandles();
  mockTracking = trackingState();
  mockGetActiveTime.mockReturnValue(0);
  mockShouldShowInfo.mockResolvedValue(false);
  mockLastKnown.mockResolvedValue({ coords: { latitude: 57.72, longitude: 12.94 } });
  mockCurrentPosition.mockResolvedValue({ coords: { latitude: 57.73, longitude: 12.95 } });
});

// One button per state: nothing recorded, recording, and paused with something to keep. "Save"
// mid-recording or "start" over a paused walk is how a recording gets lost.
it("offers only what the current state allows", async () => {
  const { rerender } = await show();
  expect(screen.getByText("Starta vandring")).toBeTruthy();
  expect(screen.queryByText("Pausa")).toBeNull();
  expect(screen.queryByText("Spara")).toBeNull();

  mockTracking = trackingState({ isTracking: true, currentSegment: segment([point(0, 1_000)]) });
  rerender(<TrailCreator />);
  expect(screen.getByText("Pausa")).toBeTruthy();
  expect(screen.queryByText("Starta vandring")).toBeNull();
  expect(screen.queryByText("Spara")).toBeNull();

  mockTracking = trackingState({ segments: [segment([point(0, 1_000), point(1, 2_000)])] });
  rerender(<TrailCreator />);
  expect(screen.getByText("Nollställ")).toBeTruthy();
  expect(screen.getByText("Spara")).toBeTruthy();
  expect(screen.getByText("Återuppta")).toBeTruthy();
  expect(screen.queryByText("Starta vandring")).toBeNull();
});

it("starts recording straight away once the info has been dismissed for good", async () => {
  await show();

  fireEvent.press(screen.getByText("Starta vandring"));
  await settle();

  expect(mockStart).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Innan du börjar")).toBeNull();
});

// The first start explains that recording continues in the background, and nothing starts behind it.
it("gates the first start behind the info dialog", async () => {
  mockShouldShowInfo.mockResolvedValue(true);
  await show();

  fireEvent.press(screen.getByText("Starta vandring"));
  await settle();

  expect(mockStart).not.toHaveBeenCalled();
  expect(screen.getByText("Innan du börjar")).toBeTruthy();
});

it("starts from the dialog, and remembers the choice not to see it again", async () => {
  mockShouldShowInfo.mockResolvedValue(true);
  await show();

  fireEvent.press(screen.getByText("Starta vandring"));
  await settle();
  fireEvent.press(screen.getByText("Visa inte detta igen"));
  // The dialog's own start button, not the one behind it.
  fireEvent.press(screen.getAllByText("Starta vandring")[1]);
  await settle();

  expect(mockDismissInfo).toHaveBeenCalledTimes(1);
  expect(mockStart).toHaveBeenCalledTimes(1);
});

it("keeps the info dialog's choice out of it when the box is left unticked", async () => {
  mockShouldShowInfo.mockResolvedValue(true);
  await show();

  fireEvent.press(screen.getByText("Starta vandring"));
  await settle();
  fireEvent.press(screen.getAllByText("Starta vandring")[1]);
  await settle();

  expect(mockDismissInfo).not.toHaveBeenCalled();
  expect(mockStart).toHaveBeenCalledTimes(1);
});

// Resetting throws away a recording that cannot be recovered.
it("throws the recording away only after it has been confirmed", async () => {
  mockTracking = trackingState({ segments: [segment([point(0, 1_000), point(1, 2_000)])] });
  await show();

  fireEvent.press(screen.getByText("Nollställ"));
  expect(mockReset).not.toHaveBeenCalled();
  expect(screen.getByText("Vill du verkligen avbryta den pågående promenad?")).toBeTruthy();

  fireEvent.press(screen.getByText("Nej"));
  expect(mockReset).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("Nollställ"));
  fireEvent.press(screen.getByText("Ja"));
  expect(mockReset).toHaveBeenCalledTimes(1);
});

// The line is the finished segments, then what the background task has persisted for the active one,
// then only the live points newer than that, so the persisted tail is not drawn twice.
it("appends only the live points the background task has not persisted", async () => {
  mockTracking = trackingState({
    isTracking: true,
    segments: [segment([point(0, 1_000)])],
    currentSegment: segment([point(1, 2_000), point(2, 3_000)]),
    liveCoordinates: [point(2, 3_000), point(3, 4_000)],
  });
  await show();

  // One finished, two persisted, and one live point past the last persisted timestamp.
  expect(routePositions()).toHaveLength(4);
  expect(routePositions().at(-1)).toEqual([12.94, 57.723]);
});

it("drops the live tail once recording stops", async () => {
  mockTracking = trackingState({
    isTracking: false,
    currentSegment: segment([point(0, 1_000), point(1, 2_000)]),
    liveCoordinates: [point(2, 3_000)],
  });
  await show();

  expect(routePositions()).toHaveLength(2);
});

// A LineString needs two points, so a one-point line would put an empty source on the map.
it("draws no line until there are two points to join", async () => {
  mockTracking = trackingState({ isTracking: true, currentSegment: segment([point(0, 1_000)]) });
  const { rerender } = await show();
  expect(routeLayer()).toBeFalsy();

  mockTracking = trackingState({ isTracking: true, currentSegment: segment([point(0, 1_000), point(1, 2_000)]) });
  rerender(<TrailCreator />);
  expect(routeLayer()).toBeTruthy();
});

// Auto-follow keeps the camera on the walker until the user pans, and then leaves the map alone.
it("stops following the route once the user has panned the map", async () => {
  mockTracking = trackingState({ isTracking: true, currentSegment: segment([point(0, 1_000)]) });
  const { rerender } = await show();
  fireEvent(screen.getByTestId("maplibre-Map"), "didFinishLoadingMap");

  mockTracking = trackingState({ isTracking: true, currentSegment: segment([point(0, 1_000), point(1, 2_000)]) });
  rerender(<TrailCreator />);
  expect(camera().easeTo).toHaveBeenCalled();

  camera().easeTo.mockClear();
  fireEvent(screen.getByTestId("maplibre-Map"), "regionDidChange", { nativeEvent: { userInteraction: true } });

  mockTracking = trackingState({
    isTracking: true,
    currentSegment: segment([point(0, 1_000), point(1, 2_000), point(2, 3_000)]),
  });
  rerender(<TrailCreator />);
  expect(camera().easeTo).not.toHaveBeenCalled();
});

// A camera command sent before the native map loads hits an unresolvable view tag, so it is replayed.
it("holds a camera move until the map is ready, then makes it", async () => {
  mockTracking = trackingState({ isTracking: true, currentSegment: segment([point(0, 1_000), point(1, 2_000)]) });
  await show();

  expect(camera().easeTo).not.toHaveBeenCalled();

  fireEvent(screen.getByTestId("maplibre-Map"), "didFinishLoadingMap");
  expect(camera().easeTo).toHaveBeenCalledTimes(1);
});

it("centres on Borås when the device has no last known position", async () => {
  mockLastKnown.mockResolvedValue(null);
  await show();

  expect(screen.getByTestId("maplibre-Camera").props.initialViewState).toEqual({
    center: [START_COORDINATE_BORAS.longitude, START_COORDINATE_BORAS.latitude],
    zoom: 16,
  });
});

// The precise fix arrives after the map is up, and does not drag the camera off a walk in progress.
it("refines the centre with a precise fix, unless the walk is already under way", async () => {
  await show();
  fireEvent(screen.getByTestId("maplibre-Map"), "didFinishLoadingMap");
  await settle();
  expect(camera().easeTo).toHaveBeenCalledWith(expect.objectContaining({ center: [12.95, 57.73], zoom: 16 }));

  resetMapHandles();
  mockTracking = trackingState({ isTracking: true, currentSegment: segment([point(0, 1_000), point(1, 2_000)]) });
  await show();
  fireEvent(screen.getByTestId("maplibre-Map"), "didFinishLoadingMap");
  await settle();
  expect(camera().easeTo).not.toHaveBeenCalledWith(expect.objectContaining({ zoom: 16 }));
});

it("shows the distance in kilometres, to two decimals", async () => {
  mockTracking = trackingState({ totalDistance: 4237 });
  await show();

  expect(screen.getByText("4.24 km")).toBeTruthy();
});

// The stopwatch is wall clock, not GPS span, and the interval only runs while recording.
it("ticks the timer once a second while recording, and stops when it does", async () => {
  jest.useFakeTimers();
  try {
    mockGetActiveTime.mockReturnValue(0);
    mockTracking = trackingState({ isTracking: true, currentSegment: segment([point(0, 1_000)]) });
    const rendered = renderWithProviders(<TrailCreator />);
    await act(async () => {});
    expect(screen.getByText("00:00:00")).toBeTruthy();

    mockGetActiveTime.mockReturnValue(1_000);
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByText("00:00:01")).toBeTruthy();

    mockTracking = trackingState({ segments: [segment([point(0, 1_000), point(1, 2_000)])] });
    mockGetActiveTime.mockReturnValue(2_000);
    rendered.rerender(<TrailCreator />);
    expect(screen.getByText("00:00:02")).toBeTruthy();

    // Paused: the interval is gone, so a later reading changes nothing on screen.
    mockGetActiveTime.mockReturnValue(9_000);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByText("00:00:02")).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});
