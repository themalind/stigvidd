import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDistance } from "geolib";
import { HIKE_STORAGE_KEY, StoredHikeState, defaultHikeState, readHikeState } from "../location-task";

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

jest.mock("geolib", () => ({
  getDistance: jest.fn(),
}));

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetDistance = getDistance as jest.Mock;

// Builds a minimal expo-location LocationObject
function makeLocation(lat: number, lng: number, accuracy: number | null, timestamp = 1000) {
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
  startTime: 500,
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
    // Default: valid active state in storage
    mockGetItem.mockResolvedValue(JSON.stringify(activeState));
    mockSetItem.mockResolvedValue(undefined);
  });

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
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: 900 }],
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
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: 900 }],
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
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: 900 }],
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
        coordinates: [{ data: { latitude: 57.7, longitude: 11.97 }, timeStamp: 900 }],
      },
    };
    mockGetItem.mockResolvedValue(JSON.stringify(stateWithPoint));

    await locationTaskCallback({
      data: {
        locations: [
          makeLocation(57.7005, 11.97, 10, 1001),
          makeLocation(57.70051, 11.97, 10, 1002),
          makeLocation(57.701, 11.97, 10, 1003),
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
          makeLocation(57.7, 11.97, 10, 1001),
          makeLocation(57.7001, 11.97, 10, 1002),
          makeLocation(57.7002, 11.97, 10, 1003),
        ],
      },
      error: null,
    });

    expect(mockSetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem.mock.calls[0][0]).toBe(HIKE_STORAGE_KEY);
  });
});
