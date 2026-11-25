// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// One file is one process, so its single mount is the first mount after a restart. keep-comment: module-scoped recovery flag

import { LocationData, Segment } from "@/data/types";
import { LOCATION_TASK_NAME, StoredHikeState, readHikeState, writeHikeState } from "@/services/location-task";
import { useLocationTracking } from "@/services/use-location-tracking";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";

jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));

const mockHasStarted = jest.fn();
const mockStopUpdates = jest.fn();

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: (...args: unknown[]) => mockHasStarted(...args),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: (...args: unknown[]) => mockStopUpdates(...args),
  watchPositionAsync: jest.fn().mockResolvedValue({ remove: jest.fn() }),
  Accuracy: { BestForNavigation: 6, High: 4 },
  ActivityType: { Fitness: 3 },
}));

jest.mock("@/services/live-location", () => ({
  isLiveLocationAvailable: () => false,
  startLiveLocation: jest.fn(),
  stopLiveLocation: jest.fn(),
  drainLiveLocation: jest.fn().mockResolvedValue([]),
  addLiveLocationListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const NOW = 1_757_000_000_000;

function fix(timeStamp: number): LocationData {
  return { data: { latitude: 57.72, longitude: 12.94 }, timeStamp };
}

function restartedMidHike(): StoredHikeState {
  const currentSegment: Segment = {
    coordinates: [fix(NOW - 120_000), fix(NOW - 30_000)],
    distance: 400,
    startTime: NOW - 180_000,
  };
  return { isTracking: true, hike: { segments: [], totalDistance: 400, totalTime: 0 }, currentSegment };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  Platform.OS = "android";
  mockHasStarted.mockResolvedValue(true);
  mockStopUpdates.mockResolvedValue(undefined);
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() });
  jest.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  Platform.OS = "ios";
  jest.restoreAllMocks();
});

it("keeps recording when the task Android restarted is still writing", async () => {
  await writeHikeState(restartedMidHike());
  let hook: ReturnType<typeof useLocationTracking> | undefined;
  function Probe() {
    hook = useLocationTracking();
    return null;
  }

  await renderWithProviders(<Probe />);
  await settle();
  await settle();

  if (!hook) throw new Error("expected the hook to render");
  expect(mockHasStarted).toHaveBeenCalledWith(LOCATION_TASK_NAME);
  expect(mockStopUpdates).not.toHaveBeenCalled();
  expect(hook.isTracking).toBe(true);
  expect((await readHikeState()).isTracking).toBe(true);
});
