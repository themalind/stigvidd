import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { ActiveHike, LocationData, Segment } from "@/data/types";
import * as Location from "expo-location";
import { getDistance } from "geolib";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  LOCATION_TASK_NAME,
  StoredHikeState,
  clearHikeState,
  defaultHikeState,
  readHikeState,
  writeHikeState,
} from "./location-task";

// How often the background task samples GPS (ms)
const SAMPLE_INTERVAL = 3000;
// Minimum meters between accepted GPS points
const MIN_DISTANCE = 3;
// Maximum meters between accepted GPS points — filters GPS jumps
const MAX_DISTANCE = 100;
// A segment shorter than this (meters) is discarded on pause
const MIN_SEGMENT_DISTANCE = 10;
// How often the UI reads AsyncStorage to reflect background task updates (ms)
const POLL_INTERVAL = 2000;

export function useLocationTracking() {
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

  // Reads the latest state from AsyncStorage and syncs it into React state
  const syncFromStorage = useCallback(async () => {
    const state = await readHikeState();
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
      setError("Permission to access location was denied.");
      return;
    }

    // Background permission is skipped in dev — the task won't run in Expo Go anyway
    if (!__DEV__) {
      const { status: bgPermission } = await Location.requestBackgroundPermissionsAsync();
      if (bgPermission !== "granted") {
        setError("Permission to access background location was denied.");
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

    // startLocationUpdatesAsync requires the background location capability compiled in,
    // which Expo Go lacks — skip the task in dev and rely on debugAddPoint for testing
    if (!__DEV__) {
      const isAlreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!isAlreadyRunning) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: SAMPLE_INTERVAL,
          distanceInterval: MIN_DISTANCE,
          foregroundService: {
            notificationTitle: "Stigvidd",
            notificationBody: "Spelar in vandring...",
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

  // Dev-only helper: injects a random nearby GPS point without real device movement
  const debugAddPoint = async () => {
    const state = await readHikeState();
    if (!state.currentSegment) return;

    const lastPoint = state.currentSegment.coordinates.at(-1);
    const prevLng = lastPoint?.data.longitude ?? 12;
    const prevLat = lastPoint?.data.latitude ?? 57;

    const newPoint: LocationData = {
      data: {
        longitude: prevLng + (Math.random() - 0.5) * 0.0005,
        latitude: prevLat + (Math.random() - 0.5) * 0.0005,
      },
      timeStamp: Date.now(),
    };

    let distanceToAdd = 0;

    if (lastPoint) {
      const distance = getDistance(lastPoint.data, newPoint.data);
      // Apply the same distance filter as the real background task
      if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) return;
      distanceToAdd = distance;
    }

    const updatedSegment = {
      ...state.currentSegment,
      coordinates: [...state.currentSegment.coordinates, newPoint],
      distance: state.currentSegment.distance + distanceToAdd,
    };

    const updatedHike = {
      ...state.hike,
      totalDistance: state.hike.totalDistance + distanceToAdd,
    };

    const newState = { ...state, currentSegment: updatedSegment, hike: updatedHike };
    await writeHikeState(newState);
    applyState(newState);
  };

  return {
    startTracking,
    stopTracking,
    resetTracking,
    isTracking,
    hike,
    currentSegment,
    getActiveTime,
    debugAddPoint,
  };
}
