// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import SaveHikeForm from "@/components/trail/trail-creator/save-hike-form";
import { ActiveHike, Segment } from "@/data/types";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { Slider } from "@miblanchard/react-native-slider";
import { act, fireEvent, screen } from "@testing-library/react-native";

const mockCreateHike = jest.fn();
const mockReplace = jest.fn();

jest.mock("@/api/hikes", () => ({
  createHike: (...args: unknown[]) => mockCreateHike(...args),
}));

jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom({ data: { identifier: "me" } }) };
});

const onDismiss = jest.fn();
const onSaveSuccess = jest.fn();

// A walk northwards, one point per minute, each about 111 m from the last.
function segment(pointCount: number, startTime = 1_700_000_000_000): Segment {
  const coordinates = Array.from({ length: pointCount }, (_, i) => ({
    data: { latitude: 57.72 + i * 0.001, longitude: 12.94 },
    timeStamp: startTime + i * 60_000,
  }));
  return { coordinates, distance: 0, startTime, endTime: startTime + (pointCount - 1) * 60_000 };
}

function hike(segments: Segment[] = [segment(6)]): ActiveHike {
  return { segments, totalDistance: 0, totalTime: 0 };
}

function show(active: ActiveHike = hike()) {
  return renderWithProviders(<SaveHikeForm hike={active} onDismiss={onDismiss} onSaveSuccess={onSaveSuccess} />);
}

function nameField() {
  return screen.getByTestId("save-hike-name");
}

// The trim control has no testID, so it is reached by type; the library's loose defaultProps need the cast.
function trimSlider() {
  return screen.UNSAFE_getByType(Slider as never);
}

async function save() {
  fireEvent.press(screen.getByText("Spara"));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateHike.mockResolvedValue(undefined);
});

it("saves the walk under the name it was given", async () => {
  show();

  fireEvent.changeText(nameField(), "Kvällspromenad");
  await save();

  expect(mockCreateHike).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Kvällspromenad", coordinates: expect.any(Array) }),
  );
});

// The field defaults to "" rather than undefined, so an untouched form is "too short", never "missing".
it("refuses a name shorter than three characters, empty included", async () => {
  show();

  await save();
  expect(screen.getByText("Namnet är för kort. Minst 3 tecken")).toBeTruthy();
  expect(mockCreateHike).not.toHaveBeenCalled();

  fireEvent.changeText(nameField(), "Ab");
  await settle();
  await save();
  expect(screen.getByText("Namnet är för kort. Minst 3 tecken")).toBeTruthy();
  expect(mockCreateHike).not.toHaveBeenCalled();
});

it("goes to the saved walks once the save lands", async () => {
  show();

  fireEvent.changeText(nameField(), "Kvällspromenad");
  await save();

  expect(onSaveSuccess).toHaveBeenCalled();
  expect(onDismiss).toHaveBeenCalled();
  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/(profile-stack)/user/my-hikes");
});

it("keeps the form open and says so when the save fails", async () => {
  mockCreateHike.mockRejectedValue(new Error("500"));
  const { store } = show();

  fireEvent.changeText(nameField(), "Kvällspromenad");
  await save();

  expect(store.get(snackbarAtom)).toMatchObject({ type: "error", message: "Något gick fel försök igen senare." });
  expect(mockReplace).not.toHaveBeenCalled();
});

// The figures shown are the trimmed ones, and they are what is saved.
it("recomputes the figures from the kept window and saves those", async () => {
  show(hike([segment(6)]));

  const full = screen.getByText(/km|m$/).props.children;

  act(() => trimSlider().props.onValueChange([0, 2]));
  const trimmed = screen.getByText(/km|m$/).props.children;
  expect(trimmed).not.toEqual(full);
  // Two minutes of the six-minute recording are left.
  expect(screen.getByText("00:02:00")).toBeTruthy();

  fireEvent.changeText(nameField(), "Kvällspromenad");
  await save();

  expect(mockCreateHike).toHaveBeenCalledWith(expect.objectContaining({ duration: 120_000 }));
  expect(mockCreateHike.mock.calls[0][0].coordinates).toHaveLength(3);
});

it("takes the ends in either order, so a dragged-past thumb still trims", () => {
  show(hike([segment(6)]));

  act(() => trimSlider().props.onValueChange([4, 1]));

  expect(screen.getByText("00:03:00")).toBeTruthy();
});

// The backend rejects a hike with no distance or duration, so it is caught here with a clear instruction.
it("blocks the save while the trim leaves nothing to save", async () => {
  show(hike([segment(6)]));

  act(() => trimSlider().props.onValueChange([2, 2]));

  expect(screen.getByText("Den valda rutten är för kort för att sparas. Justera trimningen.")).toBeTruthy();
  fireEvent.changeText(nameField(), "Kvällspromenad");
  await save();
  expect(mockCreateHike).not.toHaveBeenCalled();
});

// Two points cannot be trimmed to anything that is still a walk.
it("offers no trim control for a route too short to trim", () => {
  show(hike([segment(2)]));

  expect(screen.queryByText("Trimma rutt")).toBeNull();
  expect(screen.UNSAFE_queryByType(Slider as never)).toBeNull();
});

// The trimmed-away part stays on the map, faded, so you can see what you are cutting.
it("draws the kept route on top of the full one", () => {
  show(hike([segment(6)]));

  const layers = screen.queryAllByTestId("maplibre-Layer").map((node) => node.props.id);
  expect(layers).toContain("save-hike-route-full-line");
  expect(layers).toContain("save-hike-route-kept-line");

  act(() => trimSlider().props.onValueChange([2, 2]));

  const afterTrim = screen.queryAllByTestId("maplibre-Layer").map((node) => node.props.id);
  expect(afterTrim).toContain("save-hike-route-full-line");
  // A single kept point is not a line.
  expect(afterTrim).not.toContain("save-hike-route-kept-line");
});
