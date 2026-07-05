import { showErrorAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import { ActiveHike, Segment } from "@/data/types";
import * as Location from "expo-location";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState } from "react-native";
import {
  LOCATION_TASK_NAME,
  MIN_SEGMENT_DISTANCE,
  StoredHikeState,
  clearHikeState,
  defaultHikeState,
  maybeFinalizeStaleHike,
  mutateHikeState,
} from "./location-task";

// How often the background task samples GPS (ms). Android-only — on iOS the
// sampling cadence is driven purely by distanceInterval (see startTracking).
const SAMPLE_INTERVAL = 3000;
// Minimum meters between accepted GPS points
const MIN_DISTANCE = 3;
// How often the UI reads AsyncStorage to reflect background task updates (ms)
const POLL_INTERVAL = 2000;

export function useLocationTracking() {
  const { t } = useTranslation();
  const setError = useSetAtom(showErrorAtom);
  const setWarning = useSetAtom(showWarningAtom);
  // Holds the setInterval handle for the polling loop
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [hike, setHike] = useState<ActiveHike>(defaultHikeState.hike);
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Applies a StoredHikeState snapshot into React state
  const applyState = useCallback((state: StoredHikeState) => {
    setHike(state.hike);
    setCurrentSegment(state.currentSegment);
    setIsTracking(state.isTracking);
  }, []);

  // Reads the latest state from AsyncStorage and syncs it into React state.
  // Also auto-finalizes a forgotten recording (inactive or past the hard cap)
  // so reopening the app — or just polling while it's open — can never surface a
  // session that has been silently running for hours.
  const syncFromStorage = useCallback(async () => {
    // Check-and-finalize atomically so a concurrent task batch can't slip a write
    // in between the read and the finalize. Returns null (no write) when the
    // session isn't stale, in which case we just reflect the current state.
    let didFinalize = false;
    const state = await mutateHikeState((current) => {
      const finalized = maybeFinalizeStaleHike(current, Date.now());
      if (finalized) {
        didFinalize = true;
        return finalized;
      }
      return null;
    });
    if (didFinalize) {
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    applyState(state);
  }, [applyState]);

  // On mount: restore any in-progress hike and listen to app state changes
  useEffect(() => {
    syncFromStorage();

    // Re-sync when the app returns from background so state is never stale
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncFromStorage();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [syncFromStorage]);

  // Poll AsyncStorage while tracking so the UI stays up to date with background task writes
  useEffect(() => {
    if (isTracking) {
      pollingRef.current = setInterval(syncFromStorage, POLL_INTERVAL);
    } else {
      // Stop polling when tracking is paused or stopped
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isTracking, syncFromStorage]);

  const startTracking = async () => {
    // Foreground ("When In Use") is the only hard requirement to start recording.
    const { status: fgPermission } = await Location.requestForegroundPermissionsAsync();
    if (fgPermission !== "granted") {
      setError(t("createHike.fgPermissionDenied"));
      return;
    }

    // iOS never grants "Always" on the first request (it only offers "When In Use"
    // and escalates later), so a non-granted result must NOT block recording. With
    // foreground access + the location background mode, iOS records provisionally in
    // the background and prompts for "Always" on its own; we just nudge the user.
    const { status: bgPermission } = await Location.requestBackgroundPermissionsAsync();
    if (bgPermission !== "granted") {
      setWarning(t("createHike.bgPermissionWarning"));
    }

    // Each press of "start" opens a new segment
    const newSegment: Segment = {
      coordinates: [],
      distance: 0,
      startTime: Date.now(),
    };

    // Preserve paused hike data when resuming so segments accumulate correctly.
    // Read + write atomically so a lingering task batch can't clobber the start,
    // and persist before starting the task so it always finds a valid state.
    const newState = await mutateHikeState((existing) => ({
      isTracking: true,
      hike: existing.hike,
      currentSegment: newSegment,
    }));

    // Avoid registering the task twice if it somehow survived a previous session
    const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!isAlreadyRunning) {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        // High (~10m) rather than BestForNavigation: the latter pins the GPS at
        // maximum power for turn-by-turn nav and drains the battery over a
        // multi-hour hike, without meaningfully improving a walking track.
        accuracy: Location.Accuracy.High,
        // Android-only: caps how often the task fires. On iOS this is ignored and
        // distanceInterval alone drives sampling.
        timeInterval: SAMPLE_INTERVAL,
        distanceInterval: MIN_DISTANCE,
        // iOS-only (safely ignored on Android). Without these, iOS defaults to
        // pausesUpdatesAutomatically = true and pauses background updates when it
        // decides the user is stationary (a rest stop, a viewpoint) without
        // reliably resuming — which both drops track points and, after
        // INACTIVITY_TIMEOUT with no fixes, lets maybeFinalizeStaleHike end the
        // hike behind the user's back. Flagging this as a Fitness activity and
        // disabling auto-pause keeps a hike recording across breaks.
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        // Show the blue "using your location" status-bar indicator while recording
        // in the background, as Apple expects for continuous-location apps.
        showsBackgroundLocationIndicator: true,
        // Android foreground service: the persistent notification that keeps the
        // OS from killing the recording while backgrounded.
        foregroundService: {
          notificationTitle: "Stigvidd",
          notificationBody: t("createHike.notificationBody"),
        },
      });
    }

    applyState(newState);
  };

  const stopTracking = async () => {
    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // Finalize atomically against the latest task-written state. A batch still
    // in flight when we stopped either lands before this mutation (its points are
    // included) or after it (it no-ops because isTracking is now false) — never a
    // clobber.
    const newState = await mutateHikeState((state) => {
      const seg = state.currentSegment;
      let updatedHike = state.hike;

      if (seg) {
        const endTime = Date.now();
        const segmentDuration = endTime - seg.startTime;
        const completedSegment: Segment = { ...seg, endTime };

        // Only keep the segment if the user actually moved a meaningful distance
        if (completedSegment.distance >= MIN_SEGMENT_DISTANCE) {
          updatedHike = {
            ...state.hike,
            segments: [...state.hike.segments, completedSegment],
            // Accumulate the wall-clock duration of this segment into the total
            totalTime: state.hike.totalTime + segmentDuration,
          };
        } else {
          // Discard the too-short segment as noise, and roll back the distance the
          // background task already accumulated for it — otherwise distance stays
          // stuck at a phantom value while the segment and its time are thrown away.
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
  };

  const resetTracking = async () => {
    // Stop the background task if it's still running
    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    // Wipe persisted state and reset UI back to the initial empty hike
    await clearHikeState();
    applyState(defaultHikeState);
  };

  // Returns total elapsed time including the currently active segment (if any)
  const getActiveTime = () => {
    const completedTime = hike.totalTime;
    if (!currentSegment) return completedTime;
    return completedTime + (Date.now() - currentSegment.startTime);
  };

  return {
    startTracking,
    stopTracking,
    resetTracking,
    isTracking,
    hike,
    currentSegment,
    getActiveTime,
  };
}
