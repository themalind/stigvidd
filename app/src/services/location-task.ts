import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActiveHike, LocationData, Segment } from "@/data/types";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDistance } from "geolib";

export const LOCATION_TASK_NAME = "stigvidd-background-location";
export const HIKE_STORAGE_KEY = "@stigvidd_active_hike";

const MIN_DISTANCE = 3;
const MAX_DISTANCE = 100;
const MAX_ACCURACY = 20;

export type StoredHikeState = {
  isTracking: boolean;
  hike: ActiveHike;
  currentSegment: Segment | null;
};

export const defaultHikeState: StoredHikeState = {
  isTracking: false,
  hike: { segments: [], totalDistance: 0, totalTime: 0 },
  currentSegment: null,
};

export async function readHikeState(): Promise<StoredHikeState> {
  try {
    const stored = await AsyncStorage.getItem(HIKE_STORAGE_KEY);
    if (!stored) return defaultHikeState;
    return JSON.parse(stored) as StoredHikeState;
  } catch {
    return defaultHikeState;
  }
}

export async function writeHikeState(state: StoredHikeState): Promise<void> {
  await AsyncStorage.setItem(HIKE_STORAGE_KEY, JSON.stringify(state));
}

export async function clearHikeState(): Promise<void> {
  await AsyncStorage.removeItem(HIKE_STORAGE_KEY);
}

type LocationTaskData = {
  locations: Location.LocationObject[];
};

// Must be defined at module level before the app renders.
// This task runs in the background even when the screen is locked.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
  if (error) {
    console.error("[LocationTask] Error:", error.message);
    return;
  }

  const { locations } = data;
  if (!locations?.length) return;

  try {
    const state = await readHikeState();
    if (!state.isTracking || !state.currentSegment) return;

    let currentSegment = state.currentSegment;
    let totalDistance = state.hike.totalDistance;

    for (const location of locations) {
      if (!location.coords.accuracy || location.coords.accuracy > MAX_ACCURACY) {
        continue;
      }

      const newPoint: LocationData = {
        data: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        timeStamp: location.timestamp,
      };

      const lastPoint = currentSegment.coordinates.at(-1);
      let distanceToAdd = 0;

      if (lastPoint) {
        const distance = getDistance(lastPoint.data, newPoint.data);
        if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) {
          continue;
        }
        distanceToAdd = distance;
      }

      currentSegment = {
        ...currentSegment,
        coordinates: [...currentSegment.coordinates, newPoint],
        distance: currentSegment.distance + distanceToAdd,
      };

      totalDistance += distanceToAdd;
    }

    await writeHikeState({
      ...state,
      currentSegment,
      hike: { ...state.hike, totalDistance },
    });
  } catch (e) {
    console.error("[LocationTask] Processing error:", e);
  }
});
