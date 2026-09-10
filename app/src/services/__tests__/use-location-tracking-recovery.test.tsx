// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// Cold-launch recovery runs once per app process, tracked in module scope. A Jest module
// registry is per file, so this file is the one process: the first mount below is the cold
// launch and every later mount is a remount within it. The two tests therefore run in
// order by design, which is what makes the second one meaningful.

import { LocationData, Segment } from "@/data/types";
import { LOCATION_TASK_NAME, StoredHikeState, readHikeState, writeHikeState } from "@/services/location-task";
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

// A recording the process was killed in the middle of: still marked active in storage,
// with a segment worth keeping.
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
  mockHasStarted.mockResolvedValue(true);
  mockStopUpdates.mockResolvedValue(undefined);
  mockDrainLive.mockResolvedValue([]);
  jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);
  jest.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Each describe holds a single mount: storage is cleared between tests, so the state a
// mount leaves behind can only be asserted in the test that produced it.
describe("the first mount of a process", () => {
  // Resuming on its own would let fixes captured somewhere else hours later extend the
  // open segment into a straight line across the map.
  it("recovers a killed recording as paused, keeping what was walked", async () => {
    const harness = await mount(killedMidHike());

    expect(harness.hook().isTracking).toBe(false);
    expect(harness.hook().currentSegment).toBeNull();

    const stored = await readHikeState();
    expect(stored).toMatchObject({
      isTracking: false,
      hike: { segments: [expect.objectContaining({ distance: 400 })], totalDistance: 400 },
    });
    // Closed at the last fix, so the timer does not count the time the app was dead.
    expect(stored.hike.segments[0].endTime).toBe(NOW - 90_000);
    expect(mockStopUpdates).toHaveBeenCalledWith(LOCATION_TASK_NAME);
  });
});

describe("a later mount in the same process", () => {
  // A remount is a screen being reopened, not a cold launch: the recording is still live
  // and must not be closed under the user.
  it("leaves an active recording running", async () => {
    const harness = await mount(killedMidHike());

    expect(harness.hook().isTracking).toBe(true);
    expect(harness.hook().currentSegment).toMatchObject({ distance: 400 });
    expect(mockStopUpdates).not.toHaveBeenCalled();
  });
});
