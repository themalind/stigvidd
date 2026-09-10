// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The pure pipeline this hook drives (evaluatePoint, finalizeActiveSegment, the storage
// state machine) has its own suite, so location-task runs for real here against the
// AsyncStorage mock. What is faked is everything below it: permissions, the background
// task, and the native engine.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { LocationData, Segment } from "@/data/types";
import {
  LOCATION_TASK_NAME,
  MIN_SEGMENT_DISTANCE,
  StoredHikeState,
  readHikeState,
  writeHikeState,
} from "@/services/location-task";
import { useLocationTracking } from "@/services/use-location-tracking";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, AppState, Linking } from "react-native";

// location-task registers the background task at import; the registration itself is
// covered by its own suite.
jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));

const mockRequestForeground = jest.fn();
const mockRequestBackground = jest.fn();
const mockHasStarted = jest.fn();
const mockStartUpdates = jest.fn();
const mockStopUpdates = jest.fn();
const mockWatchPosition = jest.fn();

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestForeground(...args),
  requestBackgroundPermissionsAsync: (...args: unknown[]) => mockRequestBackground(...args),
  hasStartedLocationUpdatesAsync: (...args: unknown[]) => mockHasStarted(...args),
  startLocationUpdatesAsync: (...args: unknown[]) => mockStartUpdates(...args),
  stopLocationUpdatesAsync: (...args: unknown[]) => mockStopUpdates(...args),
  watchPositionAsync: (...args: unknown[]) => mockWatchPosition(...args),
  Accuracy: { BestForNavigation: 6, High: 4 },
  ActivityType: { Fitness: 3 },
}));

const mockIsAvailable = jest.fn();
const mockStartLive = jest.fn();
const mockStopLive = jest.fn();
const mockDrainLive = jest.fn();
const mockAddListener = jest.fn();

jest.mock("@/services/live-location", () => ({
  isLiveLocationAvailable: () => mockIsAvailable(),
  startLiveLocation: (...args: unknown[]) => mockStartLive(...args),
  stopLiveLocation: (...args: unknown[]) => mockStopLive(...args),
  drainLiveLocation: (...args: unknown[]) => mockDrainLive(...args),
  addLiveLocationListener: (...args: unknown[]) => mockAddListener(...args),
}));

const NOW = 1_757_000_000_000;

// AppState under jest has no emit, so the hook's own listener is captured and called.
const appStateListeners: ((next: string) => void)[] = [];

function emitAppState(next: string) {
  for (const listener of appStateListeners) listener(next);
}

function fix(timeStamp: number, latitude = 57.72, longitude = 12.94): LocationData {
  return { data: { latitude, longitude }, timeStamp };
}

function segment(overrides: Partial<Segment> = {}): Segment {
  return { coordinates: [], distance: 0, startTime: NOW - 60_000, ...overrides };
}

function state(overrides: Partial<StoredHikeState> = {}): StoredHikeState {
  return {
    isTracking: false,
    hike: { segments: [], totalDistance: 0, totalTime: 0 },
    currentSegment: null,
    ...overrides,
  };
}

type Tracking = ReturnType<typeof useLocationTracking>;

async function mount(seed?: StoredHikeState) {
  if (seed) await writeHikeState(seed);

  let hook!: Tracking;
  function Probe() {
    hook = useLocationTracking();
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  // The mount effect recovers, then reads storage into React state.
  await settle();
  await settle();

  return {
    ...rendered,
    // A function, not a getter: Babel's object-spread transform snapshots a getter
    // declared in the same literal as a spread.
    hook: () => hook,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();

  mockRequestForeground.mockResolvedValue({ status: "granted" });
  mockRequestBackground.mockResolvedValue({ status: "granted" });
  mockHasStarted.mockResolvedValue(false);
  mockStartUpdates.mockResolvedValue(undefined);
  mockStopUpdates.mockResolvedValue(undefined);
  mockWatchPosition.mockResolvedValue({ remove: jest.fn() });
  mockIsAvailable.mockReturnValue(false);
  mockStartLive.mockResolvedValue(undefined);
  mockStopLive.mockResolvedValue(undefined);
  mockDrainLive.mockResolvedValue([]);
  mockAddListener.mockReturnValue({ remove: jest.fn() });

  appStateListeners.length = 0;
  jest.spyOn(AppState, "addEventListener").mockImplementation((event, handler) => {
    if (event === "change") appStateListeners.push(handler as (next: string) => void);
    return { remove: jest.fn() } as never;
  });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("startTracking", () => {
  describe("permissions", () => {
    it("refuses to record without foreground access", async () => {
      mockRequestForeground.mockResolvedValue({ status: "denied" });
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(harness.store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Åtkomst till plats nekades.",
      });
      expect(mockStartUpdates).not.toHaveBeenCalled();
      expect(harness.hook().isTracking).toBe(false);
    });

    it("writes nothing to storage when foreground access is refused", async () => {
      mockRequestForeground.mockResolvedValue({ status: "denied" });
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect((await readHikeState()).isTracking).toBe(false);
    });

    it("never asks for background access once foreground is refused", async () => {
      mockRequestForeground.mockResolvedValue({ status: "denied" });
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(mockRequestBackground).not.toHaveBeenCalled();
    });

    // iOS only offers "When In Use" first and escalates later, so a refusal here must
    // warn without blocking the recording.
    it("starts recording anyway when background access is not granted", async () => {
      mockRequestBackground.mockResolvedValue({ status: "denied" });
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(Alert.alert).toHaveBeenCalledWith(
        'Aktivera platsåtkomst "Alltid"',
        expect.stringContaining("Inspelningen kan starta nu"),
        expect.any(Array),
      );
      expect(harness.hook().isTracking).toBe(true);
      expect(mockStartUpdates).toHaveBeenCalled();
    });

    it("offers to open Settings from that prompt", async () => {
      mockRequestBackground.mockResolvedValue({ status: "denied" });
      const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as { text: string; onPress?: () => void }[];
      expect(buttons.map((b) => b.text)).toEqual(["Fortsätt ändå", "Öppna inställningar"]);
      await act(async () => buttons[1].onPress?.());
      expect(openSettings).toHaveBeenCalled();
    });

    it("says nothing when both permissions are granted", async () => {
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe("the background task", () => {
    it("records with navigation accuracy and no automatic pausing", async () => {
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(mockStartUpdates).toHaveBeenCalledWith(
        LOCATION_TASK_NAME,
        expect.objectContaining({
          accuracy: 6,
          activityType: 3,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
        }),
      );
    });

    it("runs an Android foreground service so the OS keeps the recording alive", async () => {
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(mockStartUpdates.mock.calls[0][1].foregroundService).toEqual({
        notificationTitle: "Stigvidd",
        notificationBody: "Spelar in vandring...",
      });
    });

    // Starting a second time would double-record every fix.
    it("does not start a task that is already running", async () => {
      mockHasStarted.mockResolvedValue(true);
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(mockStartUpdates).not.toHaveBeenCalled();
      expect(harness.hook().isTracking).toBe(true);
    });
  });

  describe("the segment it opens", () => {
    it("starts tracking with an empty segment", async () => {
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(harness.hook().isTracking).toBe(true);
      expect(harness.hook().currentSegment).toMatchObject({ coordinates: [], distance: 0, startTime: NOW });
    });

    // Resuming a paused hike must add a segment, not restart the walk.
    it("keeps the hike recorded so far when resuming", async () => {
      const paused = state({
        hike: { segments: [segment({ endTime: NOW - 30_000 })], totalDistance: 120, totalTime: 30_000 },
      });
      const harness = await mount(paused);

      await act(async () => harness.hook().startTracking());

      expect(harness.hook().hike).toMatchObject({ totalDistance: 120, totalTime: 30_000 });
      expect(harness.hook().hike.segments).toHaveLength(1);
    });

    it("starts the live tail empty so the new segment carries no old points", async () => {
      const harness = await mount(state({ isTracking: true, currentSegment: segment({ startTime: NOW - 60_000 }) }));
      const onFix = mockWatchPosition.mock.calls[0][1] as (location: unknown) => void;
      await act(async () =>
        onFix({ coords: { latitude: 57.72, longitude: 12.94, accuracy: 5, speed: 1.2 }, timestamp: NOW }),
      );
      expect(harness.hook().liveCoordinates).toHaveLength(1);

      await act(async () => harness.hook().startTracking());

      expect(harness.hook().liveCoordinates).toEqual([]);
    });
  });

  describe("on the native engine", () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
    });

    it("starts the engine instead of the expo task", async () => {
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(mockStartLive).toHaveBeenCalled();
      expect(mockStartUpdates).not.toHaveBeenCalled();
    });

    // Fixes buffered by an earlier session would otherwise land in this segment.
    it("discards buffered fixes before starting", async () => {
      const harness = await mount();

      await act(async () => harness.hook().startTracking());

      expect(mockDrainLive.mock.invocationCallOrder[0]).toBeLessThan(mockStartLive.mock.invocationCallOrder[0]);
    });
  });
});

describe("stopTracking", () => {
  async function recording(seg: Segment) {
    const harness = await mount(state({ isTracking: true, currentSegment: seg }));
    return harness;
  }

  it("stops the running task", async () => {
    mockHasStarted.mockResolvedValue(true);
    const harness = await recording(segment());

    await act(async () => harness.hook().stopTracking());

    expect(mockStopUpdates).toHaveBeenCalledWith(LOCATION_TASK_NAME);
  });

  it("does not stop a task that is not running", async () => {
    const harness = await recording(segment());

    await act(async () => harness.hook().stopTracking());

    expect(mockStopUpdates).not.toHaveBeenCalled();
  });

  it("ends the recording", async () => {
    const harness = await recording(segment());

    await act(async () => harness.hook().stopTracking());

    expect(harness.hook().isTracking).toBe(false);
    expect(harness.hook().currentSegment).toBeNull();
  });

  describe("a segment worth keeping", () => {
    const walked = segment({
      distance: MIN_SEGMENT_DISTANCE + 5,
      startTime: NOW - 60_000,
      coordinates: [fix(NOW - 50_000), fix(NOW - 20_000)],
    });

    it("is added to the hike", async () => {
      const harness = await recording(walked);

      await act(async () => harness.hook().stopTracking());

      expect(harness.hook().hike.segments).toHaveLength(1);
      expect(harness.hook().hike.segments[0]).toMatchObject({ endTime: NOW });
    });

    // The saved duration is the span of the fixes, so the timer and the hike agree.
    it("adds the span of its fixes to the total time", async () => {
      const harness = await recording(walked);

      await act(async () => harness.hook().stopTracking());

      expect(harness.hook().hike.totalTime).toBe(30_000);
    });

    // The threshold is inclusive, so a segment exactly at it is kept.
    it("is kept at exactly the minimum distance", async () => {
      const harness = await recording(
        segment({ distance: MIN_SEGMENT_DISTANCE, coordinates: [fix(NOW - 50_000), fix(NOW - 20_000)] }),
      );

      await act(async () => harness.hook().stopTracking());

      expect(harness.hook().hike.segments).toHaveLength(1);
    });

    it("counts no time for a segment with a single fix", async () => {
      const harness = await recording(segment({ distance: MIN_SEGMENT_DISTANCE + 5, coordinates: [fix(NOW - 5_000)] }));

      await act(async () => harness.hook().stopTracking());

      expect(harness.hook().hike.totalTime).toBe(0);
    });
  });

  describe("a segment too short to keep", () => {
    it("is discarded", async () => {
      const harness = await recording(segment({ distance: MIN_SEGMENT_DISTANCE - 1, coordinates: [fix(NOW - 1_000)] }));

      await act(async () => harness.hook().stopTracking());

      expect(harness.hook().hike.segments).toHaveLength(0);
    });

    // The background task already added its distance, which would otherwise stay behind.
    it("gives back the distance the task counted for it", async () => {
      const short = segment({ distance: 4, coordinates: [fix(NOW - 1_000)] });
      const harness = await mount(
        state({ isTracking: true, currentSegment: short, hike: { segments: [], totalDistance: 30, totalTime: 0 } }),
      );

      await act(async () => harness.hook().stopTracking());

      expect(harness.hook().hike.totalDistance).toBe(26);
    });

    it("never rolls the total distance below zero", async () => {
      const short = segment({ distance: MIN_SEGMENT_DISTANCE - 1, coordinates: [fix(NOW - 1_000)] });
      const harness = await mount(
        state({ isTracking: true, currentSegment: short, hike: { segments: [], totalDistance: 5, totalTime: 0 } }),
      );

      await act(async () => harness.hook().stopTracking());

      expect(harness.hook().hike.totalDistance).toBe(0);
    });
  });

  describe("on the native engine", () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
    });

    // The last buffered fixes belong to the segment being closed.
    it("drains the engine before stopping it", async () => {
      const harness = await recording(segment());

      await act(async () => harness.hook().stopTracking());

      expect(mockDrainLive).toHaveBeenCalled();
      expect(mockStopLive).toHaveBeenCalled();
      expect(mockDrainLive.mock.invocationCallOrder.at(-1)).toBeLessThan(mockStopLive.mock.invocationCallOrder.at(-1)!);
    });

    it("leaves the expo task alone", async () => {
      const harness = await recording(segment());

      await act(async () => harness.hook().stopTracking());

      expect(mockStopUpdates).not.toHaveBeenCalled();
    });
  });

  it("reports a failure instead of leaving the UI disagreeing with the task", async () => {
    mockHasStarted.mockRejectedValue(new Error("task manager unavailable"));
    const harness = await recording(segment());

    await act(async () => harness.hook().stopTracking());

    expect(harness.store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "error",
      message: "Något gick fel med inspelningen. Försök igen.",
    });
  });
});

describe("resetTracking", () => {
  it("wipes the stored hike", async () => {
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ distance: 50 }) }));

    await act(async () => harness.hook().resetTracking());

    expect(await readHikeState()).toEqual(state());
  });

  it("resets the hike shown to the user", async () => {
    const harness = await mount(
      state({ isTracking: true, currentSegment: segment(), hike: { segments: [], totalDistance: 90, totalTime: 1 } }),
    );

    await act(async () => harness.hook().resetTracking());

    expect(harness.hook().hike).toEqual({ segments: [], totalDistance: 0, totalTime: 0 });
    expect(harness.hook().isTracking).toBe(false);
    expect(harness.hook().liveCoordinates).toEqual([]);
  });

  it("stops a running task", async () => {
    mockHasStarted.mockResolvedValue(true);
    const harness = await mount(state({ isTracking: true, currentSegment: segment() }));

    await act(async () => harness.hook().resetTracking());

    expect(mockStopUpdates).toHaveBeenCalledWith(LOCATION_TASK_NAME);
  });

  describe("on the native engine", () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
    });

    // Buffered fixes are dropped rather than ingested: this recording is being thrown away.
    it("stops the engine and throws away what it buffered", async () => {
      const harness = await mount(state({ isTracking: true, currentSegment: segment() }));

      await act(async () => harness.hook().resetTracking());

      expect(mockStopLive.mock.invocationCallOrder.at(-1)).toBeLessThan(mockDrainLive.mock.invocationCallOrder.at(-1)!);
    });
  });

  it("reports a failure", async () => {
    mockHasStarted.mockRejectedValue(new Error("task manager unavailable"));
    const harness = await mount(state({ isTracking: true, currentSegment: segment() }));

    await act(async () => harness.hook().resetTracking());

    expect(harness.store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "error",
      message: "Något gick fel med inspelningen. Försök igen.",
    });
  });
});

describe("getActiveTime", () => {
  it("is zero before anything is recorded", async () => {
    const harness = await mount();
    expect(harness.hook().getActiveTime()).toBe(0);
  });

  it("adds up the completed segments", async () => {
    const harness = await mount(
      state({
        hike: {
          segments: [
            segment({ startTime: NOW - 100_000, endTime: NOW - 80_000 }),
            segment({ startTime: NOW - 50_000, endTime: NOW - 40_000 }),
          ],
          totalDistance: 0,
          totalTime: 0,
        },
      }),
    );

    expect(harness.hook().getActiveTime()).toBe(30_000);
  });

  // A stopwatch, not a GPS span: it ticks while the user stands still.
  it("counts the open segment against the wall clock", async () => {
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ startTime: NOW - 15_000 }) }));

    expect(harness.hook().getActiveTime()).toBe(15_000);
  });

  it("adds the open segment to the completed ones", async () => {
    const harness = await mount(
      state({
        isTracking: true,
        currentSegment: segment({ startTime: NOW - 5_000 }),
        hike: {
          segments: [segment({ startTime: NOW - 100_000, endTime: NOW - 80_000 })],
          totalDistance: 0,
          totalTime: 0,
        },
      }),
    );

    expect(harness.hook().getActiveTime()).toBe(25_000);
  });

  // A segment that starts in the future — a clock correction mid-hike — must not run the
  // timer backwards.
  it("never counts the open segment backwards", async () => {
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ startTime: NOW + 5_000 }) }));

    expect(harness.hook().getActiveTime()).toBe(0);
  });

  it("never counts a segment backwards", async () => {
    const harness = await mount(
      state({
        hike: {
          segments: [segment({ startTime: NOW, endTime: NOW - 10_000 })],
          totalDistance: 0,
          totalTime: 0,
        },
      }),
    );

    expect(harness.hook().getActiveTime()).toBe(0);
  });

  it("counts a segment with no end time as lasting no time", async () => {
    const harness = await mount(
      state({ hike: { segments: [segment({ startTime: NOW - 10_000 })], totalDistance: 0, totalTime: 0 } }),
    );

    expect(harness.hook().getActiveTime()).toBe(0);
  });
});

describe("staying in step with the background task", () => {
  it("reflects what the task wrote while the app was away", async () => {
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ distance: 5 }) }));

    await writeHikeState(
      state({
        isTracking: true,
        currentSegment: segment({ distance: 250, coordinates: [fix(NOW - 1_000)] }),
        hike: { segments: [], totalDistance: 250, totalTime: 0 },
      }),
    );
    act(() => emitAppState("active"));
    await flushUntil(() => harness.hook().hike.totalDistance === 250);

    expect(harness.hook().currentSegment).toMatchObject({ distance: 250 });
  });

  it("ignores the app going to the background", async () => {
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ distance: 5 }) }));

    await writeHikeState(state({ isTracking: true, currentSegment: segment({ distance: 250 }) }));
    act(() => emitAppState("background"));
    await settle();

    expect(harness.hook().currentSegment).toMatchObject({ distance: 5 });
  });

  // A recording left running for hours is closed rather than surfaced as still active.
  it("finalizes a hike that has been inactive too long", async () => {
    const stale = segment({
      startTime: NOW - 5 * 60 * 60 * 1000,
      distance: 500,
      coordinates: [fix(NOW - 3 * 60 * 60 * 1000)],
    });
    mockHasStarted.mockResolvedValue(true);

    const harness = await mount(state({ isTracking: true, currentSegment: stale }));

    expect(harness.hook().isTracking).toBe(false);
    expect(harness.hook().hike.segments).toHaveLength(1);
    expect(mockStopUpdates).toHaveBeenCalledWith(LOCATION_TASK_NAME);
  });

  it("leaves a healthy recording running", async () => {
    const fresh = segment({ startTime: NOW - 60_000, distance: 50, coordinates: [fix(NOW - 5_000)] });

    const harness = await mount(state({ isTracking: true, currentSegment: fresh }));

    expect(harness.hook().isTracking).toBe(true);
    expect(mockStopUpdates).not.toHaveBeenCalled();
  });
});

describe("polling while recording", () => {
  // Only setInterval is faked. The AsyncStorage mock resolves through setTimeout, so a
  // full fake clock stalls every read the poll makes.
  function useTimers() {
    jest.useFakeTimers({
      doNotFake: ["setTimeout", "clearTimeout", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask", "Date"],
    });
  }

  async function tick(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
    await settle();
    await settle();
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it("picks up what the task wrote, without any app-state change", async () => {
    useTimers();
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ distance: 5 }) }));

    await writeHikeState(state({ isTracking: true, currentSegment: segment({ distance: 90 }) }));
    await tick(2_000);

    expect(harness.hook().currentSegment).toMatchObject({ distance: 90 });
  });

  it("polls again on the next interval", async () => {
    useTimers();
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ distance: 5 }) }));

    await writeHikeState(state({ isTracking: true, currentSegment: segment({ distance: 90 }) }));
    await tick(2_000);
    await writeHikeState(state({ isTracking: true, currentSegment: segment({ distance: 140 }) }));
    await tick(2_000);

    expect(harness.hook().currentSegment).toMatchObject({ distance: 140 });
  });

  it("never starts polling while idle", async () => {
    useTimers();
    const harness = await mount(state({ isTracking: false, currentSegment: null }));

    await writeHikeState(state({ isTracking: true, currentSegment: segment({ distance: 90 }) }));
    await tick(10_000);

    expect(harness.hook().currentSegment).toBeNull();
  });

  it("stops polling when the recording stops", async () => {
    useTimers();
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ distance: 5 }) }));

    await act(async () => harness.hook().stopTracking());
    await writeHikeState(state({ isTracking: true, currentSegment: segment({ distance: 90 }) }));
    await tick(10_000);

    expect(harness.hook().isTracking).toBe(false);
    expect(harness.hook().currentSegment).toBeNull();
  });
});

describe("the foreground watcher", () => {
  it("does not watch while idle", async () => {
    await mount();
    expect(mockWatchPosition).not.toHaveBeenCalled();
  });

  it("watches at navigation accuracy while recording", async () => {
    await mount(state({ isTracking: true, currentSegment: segment() }));

    expect(mockWatchPosition).toHaveBeenCalledWith(expect.objectContaining({ accuracy: 6 }), expect.any(Function));
  });

  it("appends an accepted fix to the live tail", async () => {
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ startTime: NOW - 60_000 }) }));
    const onFix = mockWatchPosition.mock.calls[0][1] as (location: unknown) => void;

    await act(async () =>
      onFix({ coords: { latitude: 57.72, longitude: 12.94, accuracy: 5, speed: 1.2 }, timestamp: NOW }),
    );

    expect(harness.hook().liveCoordinates).toHaveLength(1);
  });

  it("drops a fix the filter rejects", async () => {
    const harness = await mount(state({ isTracking: true, currentSegment: segment({ startTime: NOW - 60_000 }) }));
    const onFix = mockWatchPosition.mock.calls[0][1] as (location: unknown) => void;

    await act(async () =>
      onFix({ coords: { latitude: 57.72, longitude: 12.94, accuracy: 400, speed: 1.2 }, timestamp: NOW }),
    );

    expect(harness.hook().liveCoordinates).toEqual([]);
  });

  it("survives a watcher that will not start", async () => {
    mockWatchPosition.mockRejectedValue(new Error("no gps"));
    const harness = await mount(state({ isTracking: true, currentSegment: segment() }));

    expect(harness.hook().isTracking).toBe(true);
  });

  describe("on the native engine", () => {
    beforeEach(() => {
      mockIsAvailable.mockReturnValue(true);
    });

    // Running expo-location's watcher too would mean two competing location managers.
    it("listens to the engine rather than starting a second watcher", async () => {
      await mount(state({ isTracking: true, currentSegment: segment() }));

      expect(mockAddListener).toHaveBeenCalled();
      expect(mockWatchPosition).not.toHaveBeenCalled();
    });

    it("appends an accepted fix from the engine", async () => {
      const harness = await mount(state({ isTracking: true, currentSegment: segment({ startTime: NOW - 60_000 }) }));
      const onFix = mockAddListener.mock.calls[0][0] as (fix: unknown) => void;

      await act(async () => onFix({ latitude: 57.72, longitude: 12.94, accuracy: 5, timestamp: NOW }));

      expect(harness.hook().liveCoordinates).toHaveLength(1);
    });
  });
});
