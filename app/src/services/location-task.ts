import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActiveHike, LocationData, Segment } from "@/data/types";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDistance } from "geolib";

export const LOCATION_TASK_NAME = "stigvidd-background-location";
export const HIKE_STORAGE_KEY = "@stigvidd_active_hike";
// Stores which version of the recording-info dialog the user has dismissed with
// "don't show again". Versioned so changing the rules can re-surface the dialog.
export const RECORDING_INFO_KEY = "@stigvidd_recording_info_dismissed";

const MIN_DISTANCE = 3;
const MAX_DISTANCE = 100;
const MAX_ACCURACY = 20;

// A segment shorter than this (meters) is discarded when finalized — it's noise,
// not a walk. Shared by stopTracking and the stale-session finalizer.
export const MIN_SEGMENT_DISTANCE = 10;
// No accepted GPS point for this long (ms) means the user stopped moving and
// likely forgot to stop — auto-finalize, trimming the time to the last movement.
export const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 60 minutes
// Absolute ceiling (ms) on a single recording. Even if points keep arriving, the
// recording stops here so a forgotten session can never run indefinitely.
export const MAX_DURATION = 12 * 60 * 60 * 1000; // 12 hours
// Bump when the auto-stop rules change so previously-dismissed users see the
// updated info dialog once more.
export const RECORDING_INFO_VERSION = 1;

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

// Whether the recording-info dialog should be shown before starting. Hidden only
// if the user dismissed the current (or a newer) version with "don't show again".
export async function shouldShowRecordingInfo(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(RECORDING_INFO_KEY);
    if (!stored) return true;
    return Number.parseInt(stored, 10) < RECORDING_INFO_VERSION;
  } catch {
    return true;
  }
}

export async function dismissRecordingInfo(): Promise<void> {
  await AsyncStorage.setItem(RECORDING_INFO_KEY, String(RECORDING_INFO_VERSION));
}

// Finalizes an in-progress hike that has been left running. Returns the updated
// state if the session is stale (inactive past INACTIVITY_TIMEOUT, or longer than
// MAX_DURATION), otherwise null. The active segment's end is trimmed back to the
// last recorded GPS point so time spent not moving (or after the app was killed)
// is never counted, and is clamped to the hard cap. Pure — callers persist/stop.
export function maybeFinalizeStaleHike(state: StoredHikeState, now: number): StoredHikeState | null {
  if (!state.isTracking || !state.currentSegment) return null;

  const seg = state.currentSegment;
  const lastMovementTime = seg.coordinates.at(-1)?.timeStamp ?? seg.startTime;
  const isInactive = now - lastMovementTime > INACTIVITY_TIMEOUT;
  const isOverCap = now - seg.startTime > MAX_DURATION;
  if (!isInactive && !isOverCap) return null;

  // Keep time up to the last real movement; never beyond the hard cap.
  const endTime = Math.min(lastMovementTime, seg.startTime + MAX_DURATION);
  const segmentDuration = Math.max(0, endTime - seg.startTime);

  // Only keep the segment if the user actually moved a meaningful distance.
  const hike =
    seg.distance >= MIN_SEGMENT_DISTANCE
      ? {
          ...state.hike,
          segments: [...state.hike.segments, { ...seg, endTime }],
          totalTime: state.hike.totalTime + segmentDuration,
        }
      : state.hike;

  return { isTracking: false, hike, currentSegment: null };
}

type LocationTaskData = {
  locations: Location.LocationObject[];
};

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
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

      const updated: StoredHikeState = {
        ...state,
        currentSegment,
        hike: { ...state.hike, totalDistance },
      };

      // Auto-stop a forgotten recording: if the session has gone inactive or hit
      // the hard cap, finalize it and stop the background task so it can't run on.
      const finalized = maybeFinalizeStaleHike(updated, Date.now());
      if (finalized) {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        await writeHikeState(finalized);
        return;
      }

      await writeHikeState(updated);
    } catch (e) {
      console.error("[LocationTask] Processing error:", e);
    }
  },
);
