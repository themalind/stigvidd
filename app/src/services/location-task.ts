// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActiveHike, LocationData, Segment } from "@/data/types";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDistance } from "geolib";
import { Platform } from "react-native";
import { logger } from "./logger";

export const LOCATION_TASK_NAME = "stigvidd-background-location";
export const HIKE_STORAGE_KEY = "@stigvidd_active_hike";
// Stores which version of the recording-info dialog the user has dismissed with
// "don't show again". Versioned so changing the rules can re-surface the dialog.
export const RECORDING_INFO_KEY = "@stigvidd_recording_info_dismissed";

// Minimum meters between accepted points. Also used as the GPS distanceInterval.
export const MIN_DISTANCE = 3;
// A jump larger than this (meters) between two fixes is a GPS teleport, not travel.
const MAX_DISTANCE = 100;
// Drop fixes worse than this (metres). iOS uses a looser gate than Android: in a
// pocket with a locked screen iOS routinely reports 20-50m even at
// BestForNavigation, and a 40m fix on a hike is still a useful point — too strict
// a gate leaves gaps that render as straight lines through buildings. Android's
// value is Location.getAccuracy() passed through — the fix's own error radius at
// 68% confidence, so a 20m fix can sit a building's width off the road.
const MAX_ACCURACY = Platform.OS === "ios" ? 40 : 15;
// The gate in force once nothing has been accepted for ACCURACY_STALL_MS, so a
// bad stretch costs detail rather than becoming a hole the map draws a chord across.
const MAX_ACCURACY_STALLED = Platform.OS === "ios" ? 40 : 20;
// How long (ms) without an accepted point before the relaxed gate applies — four
// sampling intervals, the most detail the strict gate can withhold at a stretch.
export const ACCURACY_STALL_MS = 12_000;
// Reported speed (m/s) above which a fix describes travel rather than drift: 1.8
// km/h. Android reports 0 when it has none, which reads as standing still.
const MOVING_SPEED = 0.5;
// Physically impossible speed (m/s) between two fixes ⇒ GPS glitch, not movement.
// ~10 m/s (36 km/h) clears hiking/running/cycling while catching teleport spikes.
const MAX_SPEED = 10;
// Tighter cap (m/s) for fixes less than BURST_WINDOW seconds apart, where drift can
// outrun the allowance MAX_SPEED makes for suspension gaps.
const MAX_SPEED_BURST = 7;
const BURST_WINDOW = 5;
// A fix stamped more than this (ms) before the recording started is Core Location's
// cached position from an earlier session, not where the user is now.
export const MAX_FIX_AGE = 15_000;
// Accuracy (m) a fix must reach to anchor a segment's first point, and how long (ms)
// the segment waits for one before falling back to the normal gate.
const ANCHOR_ACCURACY = 20;
export const WARMUP_MS = 15_000;

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

// Closes the active segment and stops tracking. Its end is trimmed back to the last
// recorded GPS point so time spent not moving (or after the app stopped recording)
// is never counted, and is clamped to the hard cap. The segment is kept only if it
// covered a meaningful distance; otherwise it's discarded and the distance already
// accumulated for it is rolled back so totalDistance can't stay stuck at a phantom
// value. Pure. Always finalizes — callers decide *whether* to: maybeFinalizeStaleHike
// gates on staleness, and the cold-launch recovery path (use-location-tracking)
// calls it directly to recover a killed recording as paused.
export function finalizeActiveSegment(state: StoredHikeState): StoredHikeState {
  const seg = state.currentSegment;
  if (!seg) return { ...state, isTracking: false, currentSegment: null };

  const lastMovementTime = seg.coordinates.at(-1)?.timeStamp ?? seg.startTime;
  const endTime = Math.min(lastMovementTime, seg.startTime + MAX_DURATION);
  const segmentDuration = Math.max(0, endTime - seg.startTime);

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

// Finalizes an in-progress hike that has been left running, but only when it's
// actually stale — inactive past INACTIVITY_TIMEOUT, or running longer than
// MAX_DURATION. Returns the finalized state when stale, otherwise null (callers
// leave the recording running).
export function maybeFinalizeStaleHike(state: StoredHikeState, now: number): StoredHikeState | null {
  if (!state.isTracking || !state.currentSegment) return null;

  const seg = state.currentSegment;
  const lastMovementTime = seg.coordinates.at(-1)?.timeStamp ?? seg.startTime;
  const isInactive = now - lastMovementTime > INACTIVITY_TIMEOUT;
  const isOverCap = now - seg.startTime > MAX_DURATION;
  if (!isInactive && !isOverCap) return null;

  return finalizeActiveSegment(state);
}

export type PointDecision = { accept: boolean; distance: number };

// The parts of a fix beyond its position that steer the filter. Both are optional:
// a caller that has neither gets the strictest behaviour.
export type PointContext = {
  // Where the accuracy gate measures its stall from before anything has been
  // accepted — the open segment's startTime.
  trackStartedAt?: number;
  // Reported ground speed in m/s, as the receiver gives it.
  speed?: number | null;
};

// Decides whether a freshly-sampled GPS fix joins the track, and how much distance
// it adds relative to the last accepted point. Shared by the background task and
// the foreground live watcher so both filter identically. Rejects low-accuracy
// fixes, jitter within the noise envelope, and impossible speed/teleport spikes.
export function evaluatePoint(
  lastPoint: LocationData | undefined,
  candidate: LocationData,
  accuracy: number | null | undefined,
  context: PointContext = {},
): PointDecision {
  const { trackStartedAt, speed } = context;

  // Reject Core Location's cached first fix: its timestamp predates the recording.
  if (trackStartedAt !== undefined && trackStartedAt - candidate.timeStamp > MAX_FIX_AGE) {
    return { accept: false, distance: 0 };
  }

  // The gate relaxes once the track has stalled, so poor reception costs detail
  // rather than the whole stretch.
  const stalledSince = lastPoint?.timeStamp ?? trackStartedAt ?? candidate.timeStamp;
  const maxAccuracy = candidate.timeStamp - stalledSince > ACCURACY_STALL_MS ? MAX_ACCURACY_STALLED : MAX_ACCURACY;

  // Reject missing/zero and negative accuracy (iOS reports a negative
  // horizontalAccuracy when it can't determine one — the fix is unusable), as well
  // as anything worse than the gate in force.
  if (!accuracy || accuracy < 0 || accuracy > maxAccuracy) return { accept: false, distance: 0 };

  if (!lastPoint) {
    // Every later point is measured from the anchor, so it holds out for a converged
    // fix until WARMUP_MS has passed.
    const warmingUp = trackStartedAt !== undefined && candidate.timeStamp - trackStartedAt < WARMUP_MS;
    if (warmingUp && accuracy > ANCHOR_ACCURACY) return { accept: false, distance: 0 };
    return { accept: true, distance: 0 };
  }

  const distance = getDistance(lastPoint.data, candidate.data);

  const dtSeconds = (candidate.timeStamp - lastPoint.timeStamp) / 1000;
  if (dtSeconds > 0) {
    // With a valid time delta, speed — not an absolute distance cap — is the
    // plausibility gate, tighter for consecutive fixes than across a gap: a jump over
    // a suspension gap (pocket, locked screen) is real ground covered at a plausible
    // speed, the same jump over a short gap is a glitch.
    const maxSpeed = dtSeconds <= BURST_WINDOW ? MAX_SPEED_BURST : MAX_SPEED;
    if (distance / dtSeconds > maxSpeed) return { accept: false, distance: 0 };
  } else if (distance > MAX_DISTANCE) {
    // No usable time delta (missing or non-increasing timestamps): fall back to an
    // absolute distance cap to reject teleport glitches.
    return { accept: false, distance: 0 };
  }

  // A stationary phone wanders within its accuracy radius, so a move only counts
  // once it clears that noise envelope (but never below MIN_DISTANCE) — otherwise
  // drift piles up phantom distance and zig-zags in place. Consecutive fixes share
  // most of their error, so half the radius is the envelope for a receiver in
  // motion; the full radius applies while it reports standing still, where drift
  // would otherwise become distance. iOS halves throughout.
  const travelling = Platform.OS === "ios" || (speed ?? 0) > MOVING_SPEED;
  const noiseFloor = travelling ? accuracy / 2 : accuracy;
  const minStep = Math.max(MIN_DISTANCE, noiseFloor);
  if (distance < minStep) return { accept: false, distance: 0 };

  return { accept: true, distance };
}

// A minimal GPS fix as it arrives from a source (the Android background task or the
// iOS native background engine), before it's filtered/joined to the track. `accuracy`
// is horizontal accuracy in metres; `timestamp` is ms since the Unix epoch.
export type RawFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null | undefined;
  timestamp: number;
  // Reported ground speed in m/s. Absent from sources that don't supply one.
  speed?: number | null;
};

// Outcome of ingesting a batch — used by callers for task control.
export type IngestResult = {
  // No active recording, so nothing was written.
  notTracking: boolean;
  // The batch tripped the stale-session finalizer and stopped the recording.
  didFinalize: boolean;
  // Point count of the active segment after ingesting.
  resultPts: number;
};

// Runs a batch of raw GPS fixes through evaluatePoint into the stored hike,
// atomically. This is the single write path shared by the Android background
// TaskManager task and the iOS native drain, so both platforms filter, accumulate
// distance, and auto-finalize through the exact same logic. Pure of platform APIs —
// the caller decides what to do with the result (e.g. stop the task on finalize).
export async function ingestFixes(fixes: RawFix[]): Promise<IngestResult> {
  let notTracking = false;
  let didFinalize = false;
  let resultPts = 0;

  await mutateHikeState((state) => {
    if (!state.isTracking || !state.currentSegment) {
      notTracking = true;
      return null;
    }

    let currentSegment = state.currentSegment;
    let totalDistance = state.hike.totalDistance;

    for (const fix of fixes) {
      const newPoint: LocationData = {
        data: { latitude: fix.latitude, longitude: fix.longitude },
        timeStamp: fix.timestamp,
      };

      // Same filter as the foreground live watcher (see evaluatePoint) so the
      // recorded track and the drawn live tail always agree on what counts.
      const lastPoint = currentSegment.coordinates.at(-1);
      const { accept, distance } = evaluatePoint(lastPoint, newPoint, fix.accuracy, {
        trackStartedAt: currentSegment.startTime,
        speed: fix.speed,
      });
      if (!accept) {
        continue;
      }

      currentSegment = {
        ...currentSegment,
        coordinates: [...currentSegment.coordinates, newPoint],
        distance: currentSegment.distance + distance,
      };

      totalDistance += distance;
    }

    resultPts = currentSegment.coordinates.length;

    const updated: StoredHikeState = {
      ...state,
      currentSegment,
      hike: { ...state.hike, totalDistance },
    };

    // Auto-stop a forgotten recording: if the session has gone inactive or hit the
    // hard cap, persist the finalized state. Stopping the source itself happens in
    // the caller, after the lock releases.
    const finalized = maybeFinalizeStaleHike(updated, Date.now());
    if (finalized) {
      didFinalize = true;
      return finalized;
    }

    return updated;
  });

  return { notTracking, didFinalize, resultPts };
}

type LocationTaskData = {
  locations: Location.LocationObject[];
};

TaskManager.defineTask(
  LOCATION_TASK_NAME,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
    if (error) {
      // Background GPS failures happen while nobody is looking at the screen, which is
      // exactly why they need to leave the device. Never log positions — only shape.
      logger.error("Background location task error", { errorMessage: error.message });
      return;
    }

    const { locations } = data;
    if (!locations?.length) return;

    try {
      const fixes: RawFix[] = locations.map((location) => ({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        timestamp: location.timestamp,
        speed: location.coords.speed,
      }));

      const { didFinalize } = await ingestFixes(fixes);

      // The finalized state (isTracking: false) is now persisted, so any batch
      // still in flight will no-op on read — safe to stop the task.
      if (didFinalize) {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (e) {
      logger.error("Background location processing error", { errorMessage: String(e) });
    }
  },
);
