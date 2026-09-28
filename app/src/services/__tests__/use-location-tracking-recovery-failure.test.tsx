// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Recovery runs once per process (module scope), so a failing one needs its own file. keep-comment: why this file exists

import { LocationData, Segment } from "@/data/types";
import { StoredHikeState, writeHikeState } from "@/services/location-task";
import { useLocationTracking } from "@/services/use-location-tracking";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";

jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));

const mockHasStarted = jest.fn();
const mockStopUpdates = jest.fn();

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: (...args: unknown[]) => mockHasStarted(...args),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: (...args: unknown[]) => mockStopUpdates(...args),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: { BestForNavigation: 6, High: 4 },
  ActivityType: { Fitness: 3 },
}));

const mockDrainLive = jest.fn();

jest.mock("@/services/live-location", () => ({
  isLiveLocationAvailable: () => false,
  startLiveLocation: jest.fn(),
  stopLiveLocation: jest.fn(),
  drainLiveLocation: (...args: unknown[]) => mockDrainLive(...args),
  addLiveLocationListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const NOW = 1_757_000_000_000;

function fix(timeStamp: number): LocationData {
  return { data: { latitude: 57.72, longitude: 12.94 }, timeStamp };
}

function killedMidHike(): StoredHikeState {
  const currentSegment: Segment = {
    coordinates: [fix(NOW - 120_000), fix(NOW - 90_000)],
    distance: 400,
    startTime: NOW - 180_000,
  };
  return { isTracking: true, hike: { segments: [], totalDistance: 400, totalTime: 0 }, currentSegment };
}

type Tracking = ReturnType<typeof useLocationTracking>;

async function mount(seed: StoredHikeState) {
  await writeHikeState(seed);

  let hook!: Tracking;
  function Probe() {
    hook = useLocationTracking();
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  await settle();
  await settle();

  return { ...rendered, hook: () => hook };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockStopUpdates.mockResolvedValue(undefined);
  mockDrainLive.mockResolvedValue([]);
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
  jest.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("still shows the stored hike when recovering it fails", async () => {
  mockHasStarted.mockRejectedValue(new Error("task manager unavailable"));

  const harness = await mount(killedMidHike());

  expect(harness.hook().currentSegment).toMatchObject({ distance: 400 });
  expect(harness.hook().hike.totalDistance).toBe(400);
});
