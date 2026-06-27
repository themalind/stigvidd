import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { getDistance } from "geolib";
import {
  HIKE_STORAGE_KEY,
  INACTIVITY_TIMEOUT,
  MAX_DURATION,
  MIN_SEGMENT_DISTANCE,
  StoredHikeState,
  defaultHikeState,
  maybeFinalizeStaleHike,
  readHikeState,
} from "./location-task";

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

  it("discards a location whose accuracy is worse than 20m", async () => {
    await locationTaskCallback({
      data: { locations: [makeLocation(57.7, 11.97, 25)] },
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
      data: { locations: [makeLocation(57.70001, 11.97, 10)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(1); // original point unchanged
    expect(written.hike.totalDistance).toBe(0);
  });

  it("discards a point that is too far from the previous point (> 100m)", async () => {
    const stateWithPoint: StoredHikeState = {
      ...activeState,
      currentSegment: {
        ...baseSegment,
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: NOW - 100 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));
    mockGetDistance.mockReturnValue(150); // 150m — above MAX_DISTANCE of 100m

    await locationTaskCallback({
      data: { locations: [makeLocation(57.702, 11.97, 10)] },
      error: null,
    });

    const written = JSON.parse(mockSetItem.mock.calls[0][1]);
    expect(written.currentSegment.coordinates).toHaveLength(1);
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

    await locationTaskCallback({
      data: { locations: [makeLocation(57.7005, 11.97, 10)] },
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

    await locationTaskCallback({
      data: {
        locations: [
          makeLocation(57.7005, 11.97, 10, NOW + 1),
          makeLocation(57.70051, 11.97, 10, NOW + 2),
          makeLocation(57.701, 11.97, 10, NOW + 3),
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
      data: { locations: [makeLocation(57.7, 11.97, 25)] }, // bad accuracy → no new movement
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
