import { ActiveHike, LocationData, Segment } from "@/data/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDistance } from "geolib";

export const LOCATION_TASK_NAME = "stigvidd-background-location";
export const HIKE_STORAGE_KEY = "@stigvidd_active_hike";
// Stores which version of the recording-info dialog the user has dismissed with
// "don't show again". Versioned so changing the rules can re-surface the dialog.
export const RECORDING_INFO_KEY = "@stigvidd_recording_info_dismissed";

// Minimum meters between accepted points. Also used as the GPS distanceInterval.
export const MIN_DISTANCE = 3;
// A jump larger than this (meters) between two fixes is a GPS teleport, not travel.
const MAX_DISTANCE = 100;
// Fixes reported less precise than this (meters) are dropped. Kept generous so a
// brief accuracy dip (tree cover, buildings) pauses recording instead of freezing
// it — with BestForNavigation the real accuracy sits well under this.
const MAX_ACCURACY = 30;
// Physically impossible speed (m/s) between two fixes ⇒ GPS glitch, not movement.
// ~10 m/s (36 km/h) clears hiking/running/cycling while catching teleport spikes.
const MAX_SPEED = 10;

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

// Serializes read-modify-write access to the stored hike state. The background
// location task and the UI (start/stop/reset/sync) all mutate the same
// AsyncStorage record; while the app is alive they share one JS runtime, so a
// promise-chain lock makes each read→modify→write atomic. Without it, a late
// task batch can read pre-stop state and write its points back after a Pause —
// resurrecting a finished recording or double-counting distance.
let hikeStateLock: Promise<unknown> = Promise.resolve();

function withHikeStateLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = hikeStateLock.then(() => fn());
  // Keep the chain alive on rejection so one failed mutation can't wedge the lock.
  hikeStateLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// Atomically read the current state, apply `mutator`, and persist the result.
// A mutator that returns null leaves storage untouched (no write). Returns the
// state after the mutation (or the unchanged current state when null).
export async function mutateHikeState(
  mutator: (state: StoredHikeState) => StoredHikeState | null,
): Promise<StoredHikeState> {
  return withHikeStateLock(async () => {
    const current = await readHikeState();
    const next = mutator(current);
    if (next) await writeHikeState(next);
    return next ?? current;
  });
}

export async function clearHikeState(): Promise<void> {
  await withHikeStateLock(() => AsyncStorage.removeItem(HIKE_STORAGE_KEY));
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
  // When discarding it, roll back the distance the task already accumulated for
  // this segment so totalDistance can't stay stuck at a phantom value.
  const hike =
    seg.distance >= MIN_SEGMENT_DISTANCE
      ? {
          ...state.hike,
          segments: [...state.hike.segments, { ...seg, endTime }],
          totalTime: state.hike.totalTime + segmentDuration,
        }
      : {
          ...state.hike,
          totalDistance: Math.max(0, state.hike.totalDistance - seg.distance),
        };

  return { isTracking: false, hike, currentSegment: null };
}

export type PointDecision = { accept: boolean; distance: number };

// Decides whether a freshly-sampled GPS fix joins the track, and how much distance
// it adds relative to the last accepted point. Shared by the background task and
// the foreground live watcher so both filter identically. Rejects low-accuracy
// fixes, jitter within the noise envelope, and impossible speed/teleport spikes.
export function evaluatePoint(
  lastPoint: LocationData | undefined,
  candidate: LocationData,
  accuracy: number | null | undefined,
): PointDecision {
  if (!accuracy || accuracy > MAX_ACCURACY) return { accept: false, distance: 0 };
  if (!lastPoint) return { accept: true, distance: 0 };

  const distance = getDistance(lastPoint.data, candidate.data);

  // Speed spike: a jump faster than a person can travel is a GPS glitch, not a walk.
  const dtSeconds = (candidate.timeStamp - lastPoint.timeStamp) / 1000;
  if (dtSeconds > 0 && distance / dtSeconds > MAX_SPEED) return { accept: false, distance: 0 };

  // Teleport guard for the case where timestamps are missing or non-increasing.
  if (distance > MAX_DISTANCE) return { accept: false, distance: 0 };

  // A stationary phone wanders within its accuracy radius, so only count a move
  // once it clears that noise envelope (never below MIN_DISTANCE) — otherwise GPS
  // drift piles up phantom distance and zig-zags while standing still.
  const minStep = Math.max(MIN_DISTANCE, accuracy);
  if (distance < minStep) return { accept: false, distance: 0 };

  return { accept: true, distance };
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
      // Whether this batch finalized a stale session — so we can stop the task
      // outside the state lock once the finished state is safely persisted.
      let didFinalize = false;

      await mutateHikeState((state) => {
        if (!state.isTracking || !state.currentSegment) return null;

        let currentSegment = state.currentSegment;
        let totalDistance = state.hike.totalDistance;

        for (const location of locations) {
          const accuracy = location.coords.accuracy;
          if (!accuracy || accuracy > MAX_ACCURACY) {
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
            // Reject teleport-sized jumps outright.
            if (distance > MAX_DISTANCE) {
              continue;
            }
            // A stationary phone jitters within its own accuracy radius, so only
            // count a move once it clears that noise envelope (never below
            // MIN_DISTANCE). Otherwise GPS drift piles up phantom distance while
            // standing still.
            const minStep = Math.max(MIN_DISTANCE, accuracy);
            if (distance < minStep) {
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

        // Auto-stop a forgotten recording: if the session has gone inactive or
        // hit the hard cap, persist the finalized state. Stopping the task
        // itself happens after the lock releases.
        const finalized = maybeFinalizeStaleHike(updated, Date.now());
        if (finalized) {
          didFinalize = true;
          return finalized;
        }

        return updated;
      });

      // The finalized state (isTracking: false) is now persisted, so any batch
      // still in flight will no-op on read — safe to stop the task.
      if (didFinalize) {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (e) {
      console.error("[LocationTask] Processing error:", e);
    }
  },
);
