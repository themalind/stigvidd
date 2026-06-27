import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { ActiveHike, Segment } from "@/data/types";
import Constants, { ExecutionEnvironment } from "expo-constants";
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
  readHikeState,
  writeHikeState,
} from "./location-task";

// How often the background task samples GPS (ms)
const SAMPLE_INTERVAL = 3000;
// Minimum meters between accepted GPS points
const MIN_DISTANCE = 3;
// How often the UI reads AsyncStorage to reflect background task updates (ms)
const POLL_INTERVAL = 2000;

// Expo Go lacks the compiled-in background location capability, so the task can't
// run there. Detect it specifically (rather than __DEV__) so development builds —
// which DO have the native capability — record normally with live reload.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function useLocationTracking() {
  const { t } = useTranslation();
  const setError = useSetAtom(showErrorAtom);
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
    const state = await readHikeState();
    const finalized = maybeFinalizeStaleHike(state, Date.now());
    if (finalized) {
      const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      await writeHikeState(finalized);
      applyState(finalized);
      return;
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
    // Foreground permission is always required
    const { status: fgPermission } = await Location.requestForegroundPermissionsAsync();
    if (fgPermission !== "granted") {
      setError(t("createHike.fgPermissionDenied"));
      return;
    }

    // Background permission is skipped in Expo Go — the task can't run there anyway
    if (!isExpoGo) {
      const { status: bgPermission } = await Location.requestBackgroundPermissionsAsync();
      if (bgPermission !== "granted") {
        setError(t("createHike.bgPermissionDenied"));
        return;
      }
    }

    // Preserve paused hike data when resuming so segments accumulate correctly
    const existingState = await readHikeState();

    // Each press of "start" opens a new segment
    const newSegment: Segment = {
      coordinates: [],
      distance: 0,
      startTime: Date.now(),
    };

    const newState: StoredHikeState = {
      isTracking: true,
      hike: existingState.hike,
      currentSegment: newSegment,
    };

    // Persist before starting the task so the task always finds a valid state
    await writeHikeState(newState);

    // startLocationUpdatesAsync requires the background location capability compiled
    // in, which Expo Go lacks — skip the task there (no points are recorded)
    if (!isExpoGo) {
      // Avoid registering the task twice if it somehow survived a previous session
      const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isAlreadyRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: SAMPLE_INTERVAL,
          distanceInterval: MIN_DISTANCE,
          foregroundService: {
            notificationTitle: "Stigvidd",
            notificationBody: t("createHike.notificationBody"),
          },
        });
      }
    }

    applyState(newState);
  };

  const stopTracking = async () => {
    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // Read the latest state written by the background task before we finalize
    const state = await readHikeState();
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
      }
    }

    const newState: StoredHikeState = {
      isTracking: false,
      hike: updatedHike,
      currentSegment: null,
    };

    await writeHikeState(newState);
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
