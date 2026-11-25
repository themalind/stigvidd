// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { ActiveHike, LocationData, Segment } from "@/data/types";
import * as Location from "expo-location";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, AppStateStatus, Linking, Platform } from "react-native";
import {
  LOCATION_TASK_NAME,
  MIN_DISTANCE,
  MIN_SEGMENT_DISTANCE,
  StoredHikeState,
  clearHikeState,
  defaultHikeState,
  evaluatePoint,
  finalizeActiveSegment,
  ingestFixes,
  logSegmentEnded,
  maybeFinalizeStaleHike,
  mutateHikeState,
  readHikeState,
  survivedRestart,
} from "./location-task";
import { isBackgroundTaskRunning, logRecordingEnvironment } from "./recording-diagnostics";
import {
  addLiveLocationListener,
  drainLiveLocation,
  isLiveLocationAvailable,
  startLiveLocation,
  stopLiveLocation,
} from "./live-location";
import { track } from "./analytics";
import { showDialog } from "./dialog";
import { logger } from "./logger";

// keep-comment: Android only; iOS samples on distanceInterval alone
const SAMPLE_INTERVAL = 1000;
const POLL_INTERVAL = 2000;

// keep-comment: module scope tells a killed recording (new process) from a remount (same process)
let recoveryAttempted = false;

async function startLocationTask(options: Location.LocationTaskOptions): Promise<void> {
  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, options);
  } catch (error) {
    logger.error("Starting the background location task failed", { errorMessage: String(error) });
    throw error;
  }
}

async function logIfRecording(next: AppStateStatus): Promise<void> {
  if (next !== "active" && next !== "background") return;

  const state = await readHikeState().catch(() => null);
  if (!state?.isTracking) return;

  const lastFixAt = state.filterStats?.lastFixAt;
  await logRecordingEnvironment(next === "active" ? "foregrounded" : "backgrounded", {
    points: state.currentSegment?.coordinates.length ?? 0,
    msSinceLastFix: lastFixAt === undefined ? null : Date.now() - lastFixAt,
    taskRunning: await isBackgroundTaskRunning(LOCATION_TASK_NAME),
  });
}

export function useLocationTracking() {
  const { t } = useTranslation();
  const setError = useSetAtom(showErrorAtom);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [hike, setHike] = useState<ActiveHike>(defaultHikeState.hike);
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // keep-comment: visual only, so the line follows the dot; storage stays the source of truth
  const [liveCoordinates, setLiveCoordinates] = useState<LocationData[]>([]);
  const liveCoordsRef = useRef<LocationData[]>([]);
  const setLive = useCallback((coords: LocationData[]) => {
    liveCoordsRef.current = coords;
    setLiveCoordinates(coords);
  }, []);

  // keep-comment: iOS 18+ records with CLLocationUpdate + CLBackgroundActivitySession instead of the expo task
  const useNativeRef = useRef(isLiveLocationAvailable());

  // keep-comment: a ref, so the live watcher's subscription survives a poll tick
  const segmentStartRef = useRef<number | undefined>(undefined);

  // keep-comment: on iOS 18+ this is the only writer of background points
  const drainNative = useCallback(async () => {
    if (!useNativeRef.current) return;
    const fixes = await drainLiveLocation();
    if (!fixes.length) return;
    const { didFinalize } = await ingestFixes(fixes);
    if (didFinalize) await stopLiveLocation();
  }, []);

  const stopBackgroundSource = useCallback(async () => {
    if (useNativeRef.current) {
      await stopLiveLocation();
    } else {
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  }, []);

  // keep-comment: a killed recording comes back PAUSED: resuming would join fixes from somewhere
  // keep-comment: else (home, hours later) to the open segment as a straight line with phantom distance
  const recoverInterruptedHike = useCallback(async () => {
    await drainNative();

    const current = await readHikeState();
    if (!current.isTracking || !current.currentSegment) return;

    if (Platform.OS === "android" && !useNativeRef.current) {
      const taskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (survivedRestart(current, taskRunning, Date.now())) return;
    }

    logger.warn("Hike recording interrupted: the app was restarted while recording", {
      points: current.currentSegment.coordinates.length,
      minutesSinceSegmentStart: Math.round((Date.now() - current.currentSegment.startTime) / 60_000),
    });

    await stopBackgroundSource();
    await mutateHikeState((state) =>
      state.isTracking && state.currentSegment ? finalizeActiveSegment(state, "recovery") : null,
    );
  }, [drainNative, stopBackgroundSource]);

  const applyState = useCallback((state: StoredHikeState) => {
    setHike(state.hike);
    setCurrentSegment(state.currentSegment);
    segmentStartRef.current = state.currentSegment?.startTime;
    setIsTracking(state.isTracking);
  }, []);

  // keep-comment: also ends a forgotten recording, so none can run silently for hours
  const syncFromStorage = useCallback(async () => {
    // keep-comment: drained before reading, so the UI catches up on what was buffered while suspended
    await drainNative();

    // keep-comment: atomic, so a task batch cannot write between the check and the finalize
    const outcome = { finalized: false };
    const state = await mutateHikeState((current) => {
      const finalized = maybeFinalizeStaleHike(current, Date.now());
      if (finalized) {
        outcome.finalized = true;
        return finalized;
      }
      return null;
    });
    if (outcome.finalized) await stopBackgroundSource();
    applyState(state);
  }, [applyState, drainNative, stopBackgroundSource]);

  const syncSafely = useCallback(async () => {
    try {
      await syncFromStorage();
    } catch (error) {
      logger.error("Syncing the hike from storage failed", { errorMessage: String(error) });
    }
  }, [syncFromStorage]);

  useEffect(() => {
    void (async () => {
      if (!recoveryAttempted) {
        recoveryAttempted = true;
        await recoverInterruptedHike().catch((error: unknown) =>
          logger.error("Recovering an interrupted hike failed", { errorMessage: String(error) }),
        );
      }
      await syncSafely();
    })();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncSafely().then(() => logIfRecording(nextState));
      } else {
        void logIfRecording(nextState);
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [syncSafely, recoverInterruptedHike]);

  useEffect(() => {
    if (isTracking) {
      pollingRef.current = setInterval(() => void syncSafely(), POLL_INTERVAL);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isTracking, syncSafely]);

  // keep-comment: the same filter as the task, so the live tail and storage agree on what counts
  useEffect(() => {
    if (!isTracking) return;

    // keep-comment: the engine's own stream, so no second CLLocationManager competes with it
    if (useNativeRef.current) {
      const sub = addLiveLocationListener((fix) => {
        const candidate: LocationData = {
          data: { latitude: fix.latitude, longitude: fix.longitude },
          timeStamp: fix.timestamp,
        };
        const { accept } = evaluatePoint(liveCoordsRef.current.at(-1), candidate, fix.accuracy, {
          trackStartedAt: segmentStartRef.current,
        });
        if (!accept) return;
        setLive([...liveCoordsRef.current, candidate]);
      });
      return () => {
        sub?.remove();
      };
    }

    let subscription: Location.LocationSubscription | null = null;
    const watch = { cancelled: false };

    void (async () => {
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: MIN_DISTANCE },
          (location) => {
            const candidate: LocationData = {
              data: { latitude: location.coords.latitude, longitude: location.coords.longitude },
              timeStamp: location.timestamp,
            };
            const { accept } = evaluatePoint(liveCoordsRef.current.at(-1), candidate, location.coords.accuracy, {
              trackStartedAt: segmentStartRef.current,
            });
            if (!accept) return;
            setLive([...liveCoordsRef.current, candidate]);
          },
        );
        if (!watch.cancelled) {
          subscription = sub;
        } else {
          sub.remove();
        }
      } catch {
        // keep-comment: without the watcher the polled line still draws
      }
    })();

    return () => {
      watch.cancelled = true;
      subscription?.remove();
    };
  }, [isTracking, setLive]);

  const startTracking = async () => {
    try {
      await beginTracking();
    } catch (error) {
      logger.error("Starting the hike recording failed", { errorMessage: String(error) });
      setError(t("createHike.trackingError"));
    }
  };

  const beginTracking = async () => {
    const { status: fgPermission } = await Location.requestForegroundPermissionsAsync();
    if (fgPermission !== "granted") {
      setError(t("createHike.fgPermissionDenied"));
      return;
    }

    // keep-comment: a refusal must not block: iOS never grants "Always" on the first request,
    // keep-comment: but only "Always" relaunches a suspended app, hence the Open Settings dialog
    // Resume only reads it: on Android 11+ a request leaves the app for the settings page. keep-comment: platform behaviour behind the read
    const isNewHike = (await readHikeState()).hike.segments.length === 0;
    const { status: bgPermission } = isNewHike
      ? await Location.requestBackgroundPermissionsAsync()
      : await Location.getBackgroundPermissionsAsync();
    if (isNewHike && bgPermission !== "granted") {
      showDialog({
        title: t("createHike.bgPermissionTitle"),
        message: t("createHike.bgPermissionMessage"),
        icon: "map-marker-alert-outline",
        actions: [
          {
            label: t("createHike.bgPermissionOpenSettings"),
            onPress: () => void Linking.openSettings().catch(() => undefined),
          },
          { label: t("createHike.bgPermissionContinue"), variant: "text" },
        ],
      });
    }

    const newSegment: Segment = {
      coordinates: [],
      distance: 0,
      startTime: Date.now(),
    };

    // keep-comment: atomic and before the task starts, so a late batch cannot clobber it and the task finds valid state
    const newState = await mutateHikeState((existing) => ({
      isTracking: true,
      hike: existing.hike,
      currentSegment: newSegment,
    }));

    // keep-comment: engine and background permission explain most "holes in my track" reports
    track("hike.recording_started", {
      engine: useNativeRef.current ? "native_ios" : "expo_task",
      backgroundPermission: bgPermission === "granted" ? "granted" : "denied",
    });
    void logRecordingEnvironment("started", {
      engine: useNativeRef.current ? "native_ios" : "expo_task",
      segmentIndex: newState.hike.segments.length,
    });

    setLive([]);

    // keep-comment: never both engines, which would record every fix twice
    if (useNativeRef.current) {
      // keep-comment: drops fixes left from a previous session
      await drainLiveLocation();
      await startLiveLocation();
      applyState(newState);
      return;
    }

    const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!isAlreadyRunning) {
      await startLocationTask({
        // keep-comment: deliberate: High scatters 10–30 m in a pocket, cutting through buildings and failing the accuracy gate
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: SAMPLE_INTERVAL,
        distanceInterval: MIN_DISTANCE,
        // keep-comment: iOS auto-pauses at a rest stop and may never resume, dropping points and ending the hike
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        showsBackgroundLocationIndicator: true,
        // keep-comment: the notification keeps Android from killing the recording in the background
        foregroundService: {
          notificationTitle: "Stigvidd",
          notificationBody: t("createHike.notificationBody"),
        },
      });
    }

    applyState(newState);
  };

  const stopTracking = async () => {
    try {
      if (useNativeRef.current) {
        // keep-comment: before the finalize, so the last buffered points join this segment
        await drainNative();
        await stopLiveLocation();
      } else {
        const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isTaskRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      }

      // keep-comment: atomic: a late batch lands before (included) or after (no-op), never clobbering
      const newState = await mutateHikeState((state) => {
        const seg = state.currentSegment;
        let updatedHike = state.hike;

        if (seg) {
          logSegmentEnded(state, "user");
          const endTime = Date.now();
          // keep-comment: GPS span, as recomputeTrimmedHike saves it
          const first = seg.coordinates[0];
          const last = seg.coordinates.at(-1);
          const segmentDuration = first && last ? last.timeStamp - first.timeStamp : 0;
          const completedSegment: Segment = { ...seg, endTime };

          if (completedSegment.distance >= MIN_SEGMENT_DISTANCE) {
            updatedHike = {
              ...state.hike,
              segments: [...state.hike.segments, completedSegment],
              totalTime: state.hike.totalTime + segmentDuration,
            };
          } else {
            // keep-comment: also rolls back the distance the task already added, or it stays as a phantom
            updatedHike = {
              ...state.hike,
              totalDistance: Math.max(0, state.hike.totalDistance - seg.distance),
            };
          }
        }

        return {
          isTracking: false,
          hike: updatedHike,
          currentSegment: null,
        };
      });

      applyState(newState);

      // keep-comment: the track's shape, never the track; not from the task, whose fresh runtime may lack consent
      track("hike.recording_stopped", {
        reason: "user",
        durationSeconds: Math.round(newState.hike.totalTime / 1000),
        distanceMeters: newState.hike.totalDistance,
        pointCount: newState.hike.segments.reduce((n, seg) => n + seg.coordinates.length, 0),
      });
      void logRecordingEnvironment("stopped", {
        segments: newState.hike.segments.length,
        taskRunning: await isBackgroundTaskRunning(LOCATION_TASK_NAME),
      });
    } catch (error) {
      logger.error("Stopping the hike recording failed", { errorMessage: String(error) });
      setError(t("createHike.trackingError"));
    }
  };

  const resetTracking = async () => {
    try {
      if (useNativeRef.current) {
        // keep-comment: the drain discards buffered fixes so they cannot reach the next recording
        await stopLiveLocation();
        await drainLiveLocation();
      } else {
        const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (isTaskRunning) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      }
      await clearHikeState();
      setLive([]);
      applyState(defaultHikeState);
    } catch (error) {
      logger.error("Resetting the hike recording failed", { errorMessage: String(error) });
      setError(t("createHike.trackingError"));
    }
  };

  // keep-comment: a wall-clock stopwatch by design, so it ticks without movement; the saved
  // keep-comment: duration comes from GPS timestamps and may differ by a few seconds at the edges
  const getActiveTime = (now: number = Date.now()) => {
    const completedTime = hike.segments.reduce(
      (sum, seg) => sum + Math.max(0, (seg.endTime ?? seg.startTime) - seg.startTime),
      0,
    );
    if (!currentSegment) return completedTime;
    return completedTime + Math.max(0, now - currentSegment.startTime);
  };

  return {
    startTracking,
    stopTracking,
    resetTracking,
    isTracking,
    hike,
    currentSegment,
    liveCoordinates,
    getActiveTime,
  };
}
