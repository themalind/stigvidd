import AsyncStorage from "@react-native-async-storage/async-storage";
import { LocationData } from "@/data/types";
import * as Location from "expo-location";
import { getDistance } from "geolib";
import {
  HIKE_STORAGE_KEY,
  INACTIVITY_TIMEOUT,
  MAX_DURATION,
  MIN_SEGMENT_DISTANCE,
  RawFix,
  StoredHikeState,
  defaultHikeState,
  evaluatePoint,
  finalizeActiveSegment,
  ingestFixes,
  maybeFinalizeStaleHike,
  readHikeState,
} from "../location-task";

// Capture the background task callback when the module registers it
let locationTaskCallback: (body: { data: unknown; error: unknown }) => Promise<void>;

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn((_name: string, callback: typeof locationTaskCallback) => {
    locationTaskCallback = callback;
  }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("expo-location", () => ({
  hasStartedLocationUpdatesAsync: jest.fn().mockResolvedValue(false),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("geolib", () => ({
  getDistance: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetDistance = getDistance as jest.Mock;
const mockHasStarted = Location.hasStartedLocationUpdatesAsync as jest.Mock;
const mockStopUpdates = Location.stopLocationUpdatesAsync as jest.Mock;

// All the synthetic timestamps below sit near this value; the task's real-clock
// staleness check is pinned here so an active test segment is never treated as
// "forgotten". Tests that exercise the auto-stop path move the clock forward.
const NOW = 1_000_000;

// Builds a minimal expo-location LocationObject
function makeLocation(lat: number, lng: number, accuracy: number | null, timestamp = NOW) {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp,
    mocked: false,
  };
}

const baseSegment = {
  coordinates: [],
  distance: 0,
  startTime: NOW - 1000,
};

const activeState: StoredHikeState = {
  isTracking: true,
  hike: { segments: [], totalDistance: 0, totalTime: 0 },
  currentSegment: baseSegment,
};

describe("readHikeState", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns defaultHikeState when nothing is stored", async () => {
    mockGetItem.mockResolvedValue(null);

    const result = await readHikeState();

    expect(result).toEqual(defaultHikeState);
  });

  it("returns parsed state when valid JSON is stored", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify(activeState));

    const result = await readHikeState();

    expect(result).toEqual(activeState);
  });

  it("returns defaultHikeState when stored JSON is corrupt", async () => {
    mockGetItem.mockResolvedValue("{ invalid json }}}");

    const result = await readHikeState();

    expect(result).toEqual(defaultHikeState);
  });
});

describe("location background task", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Pin the clock near the synthetic timestamps so segments aren't seen as stale.
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    // Default: valid active state in storage
    mockGetItem.mockResolvedValue(JSON.stringify(activeState));
    mockSetItem.mockResolvedValue(undefined);
  });

  afterAll(() => jest.restoreAllMocks());

  it("does nothing when the task reports an error", async () => {
    await locationTaskCallback({ data: { locations: [] }, error: { message: "GPS failure" } });

    expect(mockGetItem).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("does nothing when the locations array is empty", async () => {
    await locationTaskCallback({ data: { locations: [] }, error: null });

    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("does nothing when isTracking is false", async () => {
    const pausedState: StoredHikeState = { ...activeState, isTracking: false };
    mockGetItem.mockResolvedValue(JSON.stringify(pausedState));

    await locationTaskCallback({ data: { locations: [makeLocation(57.7, 11.97, 10)] }, error: null });

    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("does nothing when currentSegment is null", async () => {
    const noSegmentState: StoredHikeState = { ...activeState, currentSegment: null };
    mockGetItem.mockResolvedValue(JSON.stringify(noSegmentState));

    await locationTaskCallback({ data: { locations: [makeLocation(57.7, 11.97, 10)] }, error: null });

    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("discards a location whose accuracy is worse than 40m", async () => {
    await locationTaskCallback({
      data: { locations: [makeLocation(57.7, 11.97, 45)] },
      error: null,
    });

    // State is read but no valid point was added — write still happens with unchanged segment
    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(0);
  });

  it("discards a location with null accuracy", async () => {
    await locationTaskCallback({
      data: { locations: [makeLocation(57.7, 11.97, null)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(0);
  });

  it("accepts the first point in a segment (no previous point) with 0 distance added", async () => {
    await locationTaskCallback({
      data: { locations: [makeLocation(57.7, 11.97, 10)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(1);
    expect(written.hike.totalDistance).toBe(0);
  });

  it("discards a point that is too close to the previous point (< 3m)", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 100 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    mockGetDistance.mockReturnValue(2); // 2m — below MIN_DISTANCE of 3m

    await locationTaskCallback({
      data: { locations: [makeLocation(57.70001, 11.97, 10, NOW + 3000)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(1); // original point unchanged
    expect(written.hike.totalDistance).toBe(0);
  });

  it("accepts a far point after a suspension gap (large distance, plausible speed) so the track re-anchors", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        startTime: NOW - 121000,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 120000 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    // 170m from the last recorded point, but 120s elapsed — the app was suspended
    // in a pocket while the user kept walking (~1.4 m/s). This is legitimate travel,
    // so it must be accepted; rejecting it as a "teleport" wedged the recording.
    mockGetDistance.mockReturnValue(170);

    await locationTaskCallback({
      data: { locations: [makeLocation(57.702, 11.97, 10, NOW)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(2);
    expect(written.hike.totalDistance).toBe(170);
  });

  it("rejects a far point when timestamps are non-increasing (teleport with no usable time delta)", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    mockGetDistance.mockReturnValue(150); // 150m — above MAX_DISTANCE of 100m

    // Same timestamp as the last point ⇒ dt = 0, so the speed check can't apply and
    // the absolute distance cap is what catches the glitch.
    await locationTaskCallback({
      data: { locations: [makeLocation(57.702, 11.97, 10, NOW)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(1);
    expect(written.hike.totalDistance).toBe(0);
  });

  it("rejects a point implying an impossible speed even when under the distance cap", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 1000 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    // 80m (< 100m cap) but only 1s elapsed ⇒ 80 m/s: a GPS teleport, not travel.
    mockGetDistance.mockReturnValue(80);

    await locationTaskCallback({
      data: { locations: [makeLocation(57.7007, 11.97, 10, NOW)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(1); // unchanged
    expect(written.hike.totalDistance).toBe(0);
  });

  it("rejects a move that stays within the fix's accuracy radius (stationary drift)", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 100 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    // 8m hop but the fix's accuracy is 20m — half the accuracy radius (10m) is the
    // noise envelope on iOS, so an 8m move is still within it and must be rejected.
    mockGetDistance.mockReturnValue(8);

    await locationTaskCallback({
      data: { locations: [makeLocation(57.70007, 11.97, 20, NOW + 3000)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(1); // unchanged
    expect(written.hike.totalDistance).toBe(0);
  });

  it("accepts a valid point and accumulates the distance", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 100 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    mockGetDistance.mockReturnValue(50); // valid: between 3m and 100m

    // 50m over 6s = ~8 m/s — under the speed cap.
    await locationTaskCallback({
      data: { locations: [makeLocation(57.7005, 11.97, 10, NOW + 6000)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(2);
    expect(written.currentSegment.distance).toBe(50);
    expect(written.hike.totalDistance).toBe(50);
  });

  it("processes a batch of locations and applies filters to each independently", async () => {
    // Distances returned per call: valid (50m), too close (1m), valid (30m)
    mockGetDistance.mockReturnValueOnce(50).mockReturnValueOnce(1).mockReturnValueOnce(30);

    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 100 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));

    // Gaps large enough that the accepted hops stay under the speed cap:
    // 50m/~6s and 30m/4s. The 1m hop is rejected as jitter regardless.
    await locationTaskCallback({
      data: {
        locations: [
          makeLocation(57.7005, 11.97, 10, NOW + 6000),
          makeLocation(57.70051, 11.97, 10, NOW + 7000),
          makeLocation(57.701, 11.97, 10, NOW + 10000),
        ],
      },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    // 1 original + 2 accepted (the 1m point is skipped)
    expect(written.currentSegment.coordinates).toHaveLength(3);
    expect(written.hike.totalDistance).toBe(80); // 50 + 30
  });

  it("writes to AsyncStorage only once per batch regardless of how many locations are processed", async () => {
    await locationTaskCallback({
      data: {
        locations: [
          makeLocation(57.7, 11.97, 10, NOW + 1),
          makeLocation(57.7001, 11.97, 10, NOW + 2),
          makeLocation(57.7002, 11.97, 10, NOW + 3),
        ],
      },
      error: null,
    });

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem.mock.calls[0][0]).toBe(HIKE_STORAGE_KEY);
  });

  it("auto-stops and finalizes when the session has gone inactive", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        distance: 50, // far enough to be kept
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 100 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    mockHasStarted.mockResolvedValue(true);
    // Jump the clock past the inactivity window with no new accepted point.
    (Date.now as jest.Mock).mockReturnValue(NOW + INACTIVITY_TIMEOUT + 5000);

    await locationTaskCallback({
      data: { locations: [makeLocation(57.7, 11.97, 45)] }, // bad accuracy → no new movement
      error: null,
    });

    expect(mockStopUpdates).toHaveBeenCalled();
    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.isTracking).toBe(false);
    expect(written.currentSegment).toBeNull();
    expect(written.hike.segments).toHaveLength(1);
  });
});

describe("maybeFinalizeStaleHike", () => {
  const point = (timeStamp: number) => ({ data: { latitude: 57.7, longitude: 11.97 }, timeStamp });

  it("returns null when not tracking", () => {
    expect(maybeFinalizeStaleHike({ ...defaultHikeState }, NOW)).toBeNull();
  });

  it("returns null when there is no current segment", () => {
    expect(maybeFinalizeStaleHike({ ...activeState, currentSegment: null }, NOW)).toBeNull();
  });

  it("returns null while the session is active and recent", () => {
    const state: StoredHikeState = {
      ...activeState,
      currentSegment: { coordinates: [point(NOW - 1000)], distance: 50, startTime: NOW - 2000 },
    };
    expect(maybeFinalizeStaleHike(state, NOW)).toBeNull();
  });

  it("finalizes an inactive session, trimming the end to the last movement", () => {
    const lastMovement = NOW;
    const state: StoredHikeState = {
      ...activeState,
      currentSegment: { coordinates: [point(lastMovement)], distance: 50, startTime: NOW - 1000 },
    };

    const result = maybeFinalizeStaleHike(state, NOW + INACTIVITY_TIMEOUT + 1);

    expect(result).not.toBeNull();
    expect(result!.isTracking).toBe(false);
    expect(result!.currentSegment).toBeNull();
    expect(result!.hike.segments).toHaveLength(1);
    expect(result!.hike.segments[0].endTime).toBe(lastMovement);
    expect(result!.hike.totalTime).toBe(lastMovement - (NOW - 1000));
  });

  it("discards a stale segment that never covered the minimum distance", () => {
    const state: StoredHikeState = {
      ...activeState,
      currentSegment: { coordinates: [point(NOW)], distance: MIN_SEGMENT_DISTANCE - 1, startTime: NOW - 1000 },
    };

    const result = maybeFinalizeStaleHike(state, NOW + INACTIVITY_TIMEOUT + 1);

    expect(result).not.toBeNull();
    expect(result!.isTracking).toBe(false);
    expect(result!.hike.segments).toHaveLength(0);
    expect(result!.hike.totalTime).toBe(0);
  });

  it("rolls back the discarded short segment's distance from the total", () => {
    // The task had already accumulated the short segment's 9m into totalDistance.
    const state: StoredHikeState = {
      isTracking: true,
      hike: { segments: [], totalDistance: 9, totalTime: 0 },
      currentSegment: { coordinates: [point(NOW)], distance: 9, startTime: NOW - 1000 },
    };

    const result = maybeFinalizeStaleHike(state, NOW + INACTIVITY_TIMEOUT + 1);

    expect(result).not.toBeNull();
    expect(result!.hike.segments).toHaveLength(0);
    expect(result!.hike.totalDistance).toBe(0); // phantom distance removed
  });

  it("clamps the kept time to the hard cap when the user keeps moving", () => {
    const startTime = NOW;
    // Last movement is well past the cap (user genuinely kept moving for >12h).
    const state: StoredHikeState = {
      ...activeState,
      currentSegment: { coordinates: [point(startTime + MAX_DURATION + 60_000)], distance: 5000, startTime },
    };

    const result = maybeFinalizeStaleHike(state, startTime + MAX_DURATION + 120_000);

    expect(result).not.toBeNull();
    expect(result!.hike.segments[0].endTime).toBe(startTime + MAX_DURATION);
    expect(result!.hike.totalTime).toBe(MAX_DURATION);
  });
});

// finalizeActiveSegment always closes the active segment (trimming to the last GPS
// point), unlike maybeFinalizeStaleHike which only does so when the session is stale.
// It backs the cold-launch recovery path: a killed recording is recovered as a
// paused, completed segment rather than a phantom "still recording" state.
describe("finalizeActiveSegment", () => {
  const point = (timeStamp: number) => ({ data: { latitude: 57.7, longitude: 11.97 }, timeStamp });

  it("finalizes even a recent, non-stale session (recovery closes it regardless)", () => {
    const lastMovement = NOW - 1000;
    const state: StoredHikeState = {
      ...activeState,
      currentSegment: { coordinates: [point(lastMovement)], distance: 50, startTime: NOW - 2000 },
    };

    // maybeFinalizeStaleHike would leave this running; finalizeActiveSegment closes it.
    expect(maybeFinalizeStaleHike(state, NOW)).toBeNull();

    const result = finalizeActiveSegment(state);
    expect(result.isTracking).toBe(false);
    expect(result.currentSegment).toBeNull();
    expect(result.hike.segments).toHaveLength(1);
    // End trimmed to the last recorded point, not "now" — the process died at that
    // point, so time after it must not be counted.
    expect(result.hike.segments[0].endTime).toBe(lastMovement);
    expect(result.hike.totalTime).toBe(lastMovement - (NOW - 2000));
  });

  it("discards a segment that never covered the minimum distance and rolls back its distance", () => {
    const state: StoredHikeState = {
      isTracking: true,
      hike: { segments: [], totalDistance: 9, totalTime: 0 },
      currentSegment: { coordinates: [point(NOW)], distance: 9, startTime: NOW - 1000 },
    };

    const result = finalizeActiveSegment(state);
    expect(result.hike.segments).toHaveLength(0);
    expect(result.hike.totalDistance).toBe(0);
    expect(result.isTracking).toBe(false);
  });

  it("clamps the kept time to the hard cap", () => {
    const startTime = NOW;
    const state: StoredHikeState = {
      ...activeState,
      currentSegment: { coordinates: [point(startTime + MAX_DURATION + 60_000)], distance: 5000, startTime },
    };

    const result = finalizeActiveSegment(state);
    expect(result.hike.segments[0].endTime).toBe(startTime + MAX_DURATION);
    expect(result.hike.totalTime).toBe(MAX_DURATION);
  });

  it("just clears tracking when there is no active segment", () => {
    const result = finalizeActiveSegment({ ...activeState, currentSegment: null });
    expect(result.isTracking).toBe(false);
    expect(result.currentSegment).toBeNull();
    expect(result.hike.segments).toHaveLength(0);
  });
});

// evaluatePoint is the single filter shared by every recording path (Android task,
// iOS native drain, foreground live tail). getDistance is mocked so each test sets
// the metres between the two points directly. Jest runs as iOS by default, so these
// exercise the iOS tuning (40m gate, half-accuracy noise floor); the Android
// divergence is covered separately below.
describe("evaluatePoint", () => {
  beforeEach(() => jest.clearAllMocks());

  const point = (timeStamp: number): LocationData => ({ data: { latitude: 57.7, longitude: 11.97 }, timeStamp });

  it("accepts the first point (no previous) with zero distance", () => {
    expect(evaluatePoint(undefined, point(NOW), 10)).toEqual({ accept: true, distance: 0 });
  });

  it("rejects a fix with null accuracy", () => {
    expect(evaluatePoint(undefined, point(NOW), null)).toEqual({ accept: false, distance: 0 });
  });

  it("rejects a fix with zero accuracy", () => {
    expect(evaluatePoint(undefined, point(NOW), 0)).toEqual({ accept: false, distance: 0 });
  });

  it("rejects a fix with negative accuracy (iOS reports it when accuracy is unknown)", () => {
    // Guard for the negative-accuracy edge: a plain falsiness check lets -1 through,
    // so it must be rejected explicitly or a garbage fix slips past the gate.
    expect(evaluatePoint(undefined, point(NOW), -1)).toEqual({ accept: false, distance: 0 });
  });

  it("accepts a fix whose accuracy sits exactly on the iOS gate (40m)", () => {
    expect(evaluatePoint(undefined, point(NOW), 40)).toEqual({ accept: true, distance: 0 });
  });

  it("rejects a fix just worse than the iOS gate (41m)", () => {
    expect(evaluatePoint(undefined, point(NOW), 41)).toEqual({ accept: false, distance: 0 });
  });

  it("rejects a move that stays within the iOS half-accuracy noise floor", () => {
    mockGetDistance.mockReturnValue(8); // accuracy 20 → floor 10; 8 < 10
    expect(evaluatePoint(point(NOW - 3000), point(NOW), 20)).toEqual({ accept: false, distance: 0 });
  });

  it("accepts a move that clears the iOS half-accuracy noise floor", () => {
    mockGetDistance.mockReturnValue(12); // accuracy 20 → floor 10; 12 ≥ 10
    expect(evaluatePoint(point(NOW - 3000), point(NOW), 20)).toEqual({ accept: true, distance: 12 });
  });

  it("never drops the step floor below MIN_DISTANCE, even for a pinpoint fix", () => {
    // accuracy 4 → half 2, but MIN_DISTANCE (3) is the floor.
    mockGetDistance.mockReturnValue(2);
    expect(evaluatePoint(point(NOW - 3000), point(NOW), 4)).toEqual({ accept: false, distance: 0 });
    mockGetDistance.mockReturnValue(3);
    expect(evaluatePoint(point(NOW - 3000), point(NOW), 4)).toEqual({ accept: true, distance: 3 });
  });

  it("rejects an impossible speed when the time delta is valid", () => {
    mockGetDistance.mockReturnValue(80); // 80m in 1s = 80 m/s
    expect(evaluatePoint(point(NOW - 1000), point(NOW), 10)).toEqual({ accept: false, distance: 0 });
  });

  it("accepts a jump at exactly the speed cap", () => {
    mockGetDistance.mockReturnValue(10); // 10m in 1s = 10 m/s (== MAX_SPEED, not over)
    expect(evaluatePoint(point(NOW - 1000), point(NOW), 10)).toEqual({ accept: true, distance: 10 });
  });

  it("accepts a large jump over a long gap so the track re-anchors after a suspension", () => {
    mockGetDistance.mockReturnValue(300); // 300m over 120s = 2.5 m/s
    expect(evaluatePoint(point(NOW - 120000), point(NOW), 10)).toEqual({ accept: true, distance: 300 });
  });

  it("falls back to the absolute distance cap when the time delta is not usable", () => {
    mockGetDistance.mockReturnValue(150); // dt = 0, 150 > MAX_DISTANCE
    expect(evaluatePoint(point(NOW), point(NOW), 10)).toEqual({ accept: false, distance: 0 });
  });

  it("accepts a within-cap move when the time delta is not usable", () => {
    mockGetDistance.mockReturnValue(50); // dt = 0, 50 ≤ cap and clears the floor
    expect(evaluatePoint(point(NOW), point(NOW), 10)).toEqual({ accept: true, distance: 50 });
  });
});

// The iOS and Android gates diverge deliberately (see evaluatePoint): iOS relaxes
// the accuracy gate to 40m and halves the noise floor. These load a fresh copy of
// the module with Platform.OS forced to "android" and assert the same inputs decide
// differently — a guard against the two platforms being accidentally unified.
describe("evaluatePoint — Android platform divergence", () => {
  function loadAndroid() {
    let evaluatePointFn!: typeof evaluatePoint;
    let getDistanceMock!: jest.Mock;
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({ Platform: { OS: "android" } }));
      // Dynamic require is required to re-load the module under the forced platform.
      /* eslint-disable @typescript-eslint/no-require-imports */
      evaluatePointFn = require("../location-task").evaluatePoint;
      getDistanceMock = require("geolib").getDistance as jest.Mock;
      /* eslint-enable @typescript-eslint/no-require-imports */
    });
    jest.dontMock("react-native");
    return { evaluatePoint: evaluatePointFn, getDistance: getDistanceMock };
  }

  const point = (timeStamp: number): LocationData => ({ data: { latitude: 57.7, longitude: 11.97 }, timeStamp });

  it("uses the stricter 20m accuracy gate that iOS relaxes to 40m", () => {
    const { evaluatePoint: evalAndroid } = loadAndroid();
    // 25m accuracy: accepted on iOS (< 40), rejected on Android (> 20).
    expect(evaluatePoint(undefined, point(NOW), 25)).toEqual({ accept: true, distance: 0 });
    expect(evalAndroid(undefined, point(NOW), 25)).toEqual({ accept: false, distance: 0 });
  });

  it("uses the full accuracy radius as its noise floor where iOS uses half", () => {
    const { evaluatePoint: evalAndroid, getDistance: getDistanceAndroid } = loadAndroid();
    mockGetDistance.mockReturnValue(15);
    getDistanceAndroid.mockReturnValue(15);
    // 15m move, accuracy 20: iOS floor 10 → accept; Android floor 20 → reject.
    expect(evaluatePoint(point(NOW - 3000), point(NOW), 20)).toEqual({ accept: true, distance: 15 });
    expect(evalAndroid(point(NOW - 3000), point(NOW), 20)).toEqual({ accept: false, distance: 0 });
  });
});

// ingestFixes is the shared write path: it runs a batch of raw fixes through
// evaluatePoint into stored state atomically. The Android TaskManager task and the
// iOS native drain both go through it, so these tests cover that shared behaviour
// directly (the task-callback tests above exercise the same path via Android).
describe("ingestFixes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    mockGetItem.mockResolvedValue(JSON.stringify(activeState));
    mockSetItem.mockResolvedValue(undefined);
  });

  afterAll(() => jest.restoreAllMocks());

  const fix = (accuracy: number, timestamp = NOW): RawFix => ({
    latitude: 57.7,
    longitude: 11.97,
    accuracy,
    timestamp,
  });

  it("reports notTracking and writes nothing when no recording is active", async () => {
    mockGetItem.mockResolvedValue(JSON.stringify({ ...activeState, isTracking: false }));

    const result = await ingestFixes([fix(10)]);

    expect(result.notTracking).toBe(true);
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it("ingests a batch, accumulating distance and reporting the point count", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 100 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    mockGetDistance.mockReturnValueOnce(50).mockReturnValueOnce(30);

    const result = await ingestFixes([fix(10, NOW + 6000), fix(10, NOW + 12000)]);

    expect(result.notTracking).toBe(false);
    expect(result.didFinalize).toBe(false);
    expect(result.resultPts).toBe(3); // 1 existing + 2 accepted
    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.hike.totalDistance).toBe(80);
  });

  it("finalizes and reports didFinalize when the batch leaves the session stale", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        distance: 50, // far enough to be kept
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 100 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    (Date.now as jest.Mock).mockReturnValue(NOW + INACTIVITY_TIMEOUT + 5000);

    // Bad accuracy → no accepted movement, so the session goes stale and finalizes.
    const result = await ingestFixes([fix(45)]);

    expect(result.didFinalize).toBe(true);
    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.isTracking).toBe(false);
    expect(written.hike.segments).toHaveLength(1);
  });
});
