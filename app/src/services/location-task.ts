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
import type { RecordingStopReason } from "./event-catalogue";
import { logger } from "./logger";

export const LOCATION_TASK_NAME = "stigvidd-background-location";
export const HIKE_STORAGE_KEY = "@stigvidd_active_hike";
export const RECORDING_INFO_KEY = "@stigvidd_recording_info_dismissed";

// keep-comment: metres; also the GPS distanceInterval
export const MIN_DISTANCE = 3;
// keep-comment: metres; a bigger jump without a usable time delta is a teleport
const MAX_DISTANCE = 100;
// A dropped fix becomes a straight chord on the map, across a lake where the path keep-comment: why the gate is loose
// bends round one (#239), so the gate only rejects fixes worse than that chord. keep-comment: why the gate is loose
const MAX_ACCURACY = Platform.OS === "ios" ? 40 : 30;
// keep-comment: after a stall, so a bad stretch costs detail rather than becoming a chord
const MAX_ACCURACY_STALLED = 40;
export const ACCURACY_STALL_MS = 12_000;
// Computed from the last accepted point: Android reports 0 for much of a walk. keep-comment: hidden platform trap
const MOVING_SPEED = 0.5;
// keep-comment: m/s; 36 km/h clears hiking, running and cycling but catches teleport spikes
const MAX_SPEED = 10;
// keep-comment: tighter within BURST_WINDOW seconds, where drift outruns the allowance for suspension gaps
const MAX_SPEED_BURST = 7;
const BURST_WINDOW = 5;
// keep-comment: ms; older than the recording start is Core Location's cached fix from an earlier session
export const MAX_FIX_AGE = 15_000;
// keep-comment: a segment's first point waits WARMUP_MS for this accuracy, since all later points measure from it
const ANCHOR_ACCURACY = 20;
export const WARMUP_MS = 15_000;

// keep-comment: metres; a shorter segment is noise and is discarded
export const MIN_SEGMENT_DISTANCE = 10;
// keep-comment: no accepted point this long means a forgotten recording, ended at the last movement
export const INACTIVITY_TIMEOUT = 60 * 60 * 1000;
// keep-comment: a hard cap, even while points keep arriving
export const MAX_DURATION = 12 * 60 * 60 * 1000;
// keep-comment: bump when the auto-stop rules change, so the info dialog shows again
export const RECORDING_INFO_VERSION = 1;

export type FilterStats = {
  accepted: number;
  rejected: Partial<Record<RejectReason, number>>;
  accuracyBuckets: Partial<Record<AccuracyBucket, number>>;
  longestGapMs: number;
  // Between fixes the OS delivered, accepted or not: a long one means the OS stopped sending GPS. keep-comment: tells OS throttling from filtering
  longestFixGapMs?: number;
  lastFixAt?: number;
  longestStepM: number;
  // Accepted steps the reported-speed rule this replaced would have dropped (Android). keep-comment: names the old rule
  reportedStillButMoving: number;
};

type AccuracyBucket = "le10" | "le20" | "le30" | "le40" | "over40" | "none";

export type StoredHikeState = {
  isTracking: boolean;
  hike: ActiveHike;
  currentSegment: Segment | null;
  // The open segment's, kept in storage because the Android task can run in its own JS runtime. keep-comment: why not module state
  filterStats?: FilterStats;
};

export const defaultHikeState: StoredHikeState = {
  isTracking: false,
  hike: { segments: [], totalDistance: 0, totalTime: 0 },
  currentSegment: null,
};

export const CORRUPT_HIKE_STORAGE_KEY = `${HIKE_STORAGE_KEY}_corrupt`;

// A default on a failed read would be written over the recording by mutateHikeState. keep-comment: hidden data-loss trap
export async function readHikeState(): Promise<StoredHikeState> {
  let stored: string | null;
  try {
    stored = await AsyncStorage.getItem(HIKE_STORAGE_KEY);
  } catch (error) {
    logger.error("Reading the stored hike failed", { errorMessage: String(error) });
    throw error;
  }
  if (!stored) return defaultHikeState;
  try {
    return JSON.parse(stored) as StoredHikeState;
  } catch (error) {
    logger.error("Stored hike is corrupt; set aside", { errorMessage: String(error), length: stored.length });
    try {
      await AsyncStorage.setItem(CORRUPT_HIKE_STORAGE_KEY, stored);
    } catch {
      return defaultHikeState;
    }
    return defaultHikeState;
  }
}

const hikeStateListeners = new Set<() => void>();

export function onHikeStateChange(listener: () => void): () => void {
  hikeStateListeners.add(listener);
  return () => {
    hikeStateListeners.delete(listener);
  };
}

function notifyHikeStateChange(): void {
  hikeStateListeners.forEach((listener) => listener());
}

export async function writeHikeState(state: StoredHikeState): Promise<void> {
  await AsyncStorage.setItem(HIKE_STORAGE_KEY, JSON.stringify(state));
}

// keep-comment: the task and the UI share one record; unlocked, a late batch writes back after a
// keep-comment: pause, resurrecting the recording or counting distance twice
let hikeStateLock: Promise<unknown> = Promise.resolve();

function withHikeStateLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = hikeStateLock.then(() => fn());
  // keep-comment: survives a rejection, so one failure cannot wedge the lock
  hikeStateLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

// keep-comment: a mutator returning null writes nothing
export async function mutateHikeState(
  mutator: (state: StoredHikeState) => StoredHikeState | null,
): Promise<StoredHikeState> {
  return withHikeStateLock(async () => {
    const current = await readHikeState();
    const next = mutator(current);
    if (next) await writeHikeState(next);
    // keep-comment: only on start, pause and resume, not on each GPS batch
    if (next && next.isTracking !== current.isTracking) notifyHikeStateChange();
    return next ?? current;
  });
}

export async function clearHikeState(): Promise<void> {
  await withHikeStateLock(() => AsyncStorage.removeItem(HIKE_STORAGE_KEY));
  notifyHikeStateChange();
}

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

// keep-comment: ends at the last GPS point, so idle time never counts; a too-short segment rolls back its distance
export function finalizeActiveSegment(state: StoredHikeState, reason: RecordingStopReason): StoredHikeState {
  const seg = state.currentSegment;
  if (!seg) return { isTracking: false, hike: state.hike, currentSegment: null };

  logSegmentEnded(state, reason);

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

export function logSegmentEnded(state: StoredHikeState, reason: RecordingStopReason, now: number = Date.now()): void {
  const seg = state.currentSegment;
  if (!seg) return;

  const stats = state.filterStats ?? emptyFilterStats();
  const received = stats.accepted + Object.values(stats.rejected).reduce((sum: number, n) => sum + (n ?? 0), 0);
  const durationMinutes = Math.max(0, now - seg.startTime) / 60_000;

  logger.info("Hike recording segment ended", {
    reason,
    segmentIndex: state.hike.segments.length,
    durationSeconds: Math.round(durationMinutes * 60),
    points: seg.coordinates.length,
    segmentMetres: Math.round(seg.distance),
    fixesReceived: received,
    fixesPerMinute: durationMinutes > 0 ? Math.round((received / durationMinutes) * 10) / 10 : 0,
    accepted: stats.accepted,
    ...prefixed("rejected_", stats.rejected),
    ...prefixed("accuracy_", stats.accuracyBuckets),
    longestGapMs: stats.longestGapMs,
    longestFixGapMs: stats.longestFixGapMs ?? 0,
    msSinceLastFix: stats.lastFixAt === undefined ? null : now - stats.lastFixAt,
    longestStepM: Math.round(stats.longestStepM),
    reportedStillButMoving: stats.reportedStillButMoving,
  });
}

function prefixed(prefix: string, counts: Partial<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).map(([key, count]) => [`${prefix}${key}`, count ?? 0]));
}

const emptyFilterStats = (): FilterStats => ({
  accepted: 0,
  rejected: {},
  accuracyBuckets: {},
  longestGapMs: 0,
  longestStepM: 0,
  reportedStillButMoving: 0,
});

function accuracyBucket(accuracy: number | null | undefined): AccuracyBucket {
  if (!accuracy || accuracy < 0) return "none";
  if (accuracy <= 10) return "le10";
  if (accuracy <= 20) return "le20";
  if (accuracy <= 30) return "le30";
  if (accuracy <= 40) return "le40";
  return "over40";
}

function recordFix(
  stats: FilterStats,
  fix: RawFix,
  lastPoint: LocationData | undefined,
  decision: PointDecision,
  segmentStart: number,
): FilterStats {
  const bucket = accuracyBucket(fix.accuracy);
  const fixGapMs = Math.max(0, fix.timestamp - (stats.lastFixAt ?? segmentStart));
  const next: FilterStats = {
    ...stats,
    rejected: { ...stats.rejected },
    accuracyBuckets: { ...stats.accuracyBuckets, [bucket]: (stats.accuracyBuckets[bucket] ?? 0) + 1 },
    longestFixGapMs: Math.max(stats.longestFixGapMs ?? 0, fixGapMs),
    lastFixAt: Math.max(stats.lastFixAt ?? 0, fix.timestamp),
  };

  if (!decision.accept) {
    const reason = decision.reason ?? "noise";
    next.rejected[reason] = (next.rejected[reason] ?? 0) + 1;
    return next;
  }

  next.accepted += 1;
  if (!lastPoint) return next;

  next.longestGapMs = Math.max(next.longestGapMs, fix.timestamp - lastPoint.timeStamp);
  next.longestStepM = Math.max(next.longestStepM, decision.distance);
  const reportedStill = (fix.speed ?? 0) <= MOVING_SPEED;
  if (Platform.OS === "android" && reportedStill && decision.distance < (fix.accuracy ?? 0)) {
    next.reportedStillButMoving += 1;
  }
  return next;
}

export function maybeFinalizeStaleHike(state: StoredHikeState, now: number): StoredHikeState | null {
  if (!state.isTracking || !state.currentSegment) return null;

  const seg = state.currentSegment;
  const lastMovementTime = seg.coordinates.at(-1)?.timeStamp ?? seg.startTime;
  const isInactive = now - lastMovementTime > INACTIVITY_TIMEOUT;
  const isOverCap = now - seg.startTime > MAX_DURATION;
  if (!isInactive && !isOverCap) return null;

  return finalizeActiveSegment(state, isOverCap ? "max_duration" : "inactivity");
}

export const RESTART_GRACE = 10 * 60 * 1000;

export async function hasHikeInProgress(): Promise<boolean> {
  const state = await readHikeState();
  return state.isTracking || state.currentSegment !== null || state.hike.segments.length > 0;
}

// True when a running task wrote recently: Android restarts the task with the process, so it kept recording. keep-comment: why a new process is not always a dead engine
export function survivedRestart(state: StoredHikeState, taskRunning: boolean, now: number): boolean {
  if (!taskRunning || !state.isTracking || !state.currentSegment) return false;
  const seg = state.currentSegment;
  const lastActivity = seg.coordinates.at(-1)?.timeStamp ?? seg.startTime;
  return now - lastActivity <= RESTART_GRACE;
}

export type RejectReason = "stale" | "accuracy" | "warmup" | "speed" | "teleport" | "noise";

export type PointDecision = { accept: boolean; distance: number; reason?: RejectReason };

export type PointContext = {
  trackStartedAt?: number;
};

const reject = (reason: RejectReason): PointDecision => ({ accept: false, distance: 0, reason });

// keep-comment: shared by the task and the live watcher, so both filter alike
export function evaluatePoint(
  lastPoint: LocationData | undefined,
  candidate: LocationData,
  accuracy: number | null | undefined,
  context: PointContext = {},
): PointDecision {
  const { trackStartedAt } = context;

  if (trackStartedAt !== undefined && trackStartedAt - candidate.timeStamp > MAX_FIX_AGE) {
    return reject("stale");
  }

  const stalledSince = lastPoint?.timeStamp ?? trackStartedAt ?? candidate.timeStamp;
  const maxAccuracy = candidate.timeStamp - stalledSince > ACCURACY_STALL_MS ? MAX_ACCURACY_STALLED : MAX_ACCURACY;

  // keep-comment: iOS reports a negative accuracy when it has none, and that fix is unusable
  if (!accuracy || accuracy < 0 || accuracy > maxAccuracy) return reject("accuracy");

  if (!lastPoint) {
    const warmingUp = trackStartedAt !== undefined && candidate.timeStamp - trackStartedAt < WARMUP_MS;
    if (warmingUp && accuracy > ANCHOR_ACCURACY) return reject("warmup");
    return { accept: true, distance: 0 };
  }

  const distance = getDistance(lastPoint.data, candidate.data);

  const dtSeconds = (candidate.timeStamp - lastPoint.timeStamp) / 1000;
  if (dtSeconds > 0) {
    // keep-comment: speed, not distance: a jump across a suspension gap is real ground, the same jump in seconds a glitch
    const maxSpeed = dtSeconds <= BURST_WINDOW ? MAX_SPEED_BURST : MAX_SPEED;
    if (distance / dtSeconds > maxSpeed) return reject("speed");
  } else if (distance > MAX_DISTANCE) {
    return reject("teleport");
  }

  // keep-comment: a still phone wanders within its accuracy radius, so a move must clear it or drift becomes distance
  // keep-comment: moving fixes share most of their error, so half the radius; the full radius while standing still
  // keep-comment: measured from the last accepted point, drift over a pause stays under MOVING_SPEED; iOS always halves
  const travelling = Platform.OS === "ios" || (dtSeconds > 0 && distance / dtSeconds > MOVING_SPEED);
  const noiseFloor = travelling ? accuracy / 2 : accuracy;
  const minStep = Math.max(MIN_DISTANCE, noiseFloor);
  if (distance < minStep) return reject("noise");

  return { accept: true, distance };
}

// keep-comment: accuracy in metres, timestamp in epoch ms
export type RawFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null | undefined;
  timestamp: number;
  speed?: number | null;
};

export type IngestResult = {
  notTracking: boolean;
  didFinalize: boolean;
  resultPts: number;
};

// keep-comment: the one write path for the Android task and the iOS drain, so both platforms behave alike
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
    let filterStats = state.filterStats ?? emptyFilterStats();

    for (const fix of fixes) {
      const newPoint: LocationData = {
        data: { latitude: fix.latitude, longitude: fix.longitude },
        timeStamp: fix.timestamp,
      };

      const lastPoint = currentSegment.coordinates.at(-1);
      const decision = evaluatePoint(lastPoint, newPoint, fix.accuracy, {
        trackStartedAt: currentSegment.startTime,
      });
      filterStats = recordFix(filterStats, fix, lastPoint, decision, currentSegment.startTime);
      const { accept, distance } = decision;
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
      filterStats,
    };

    // keep-comment: the caller stops the source, after the lock releases
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
      // keep-comment: never log positions here, only the error
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

      // keep-comment: safe now: the finalized state is stored, so a batch in flight no-ops
      if (didFinalize) {
        const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (e) {
      logger.error("Background location processing error", { errorMessage: String(e) });
    }
  },
);
