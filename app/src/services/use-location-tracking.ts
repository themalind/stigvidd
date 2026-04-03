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

const SAMPLE_INTERVAL = 3000;
const MIN_DISTANCE = 3;
const MAX_DISTANCE = 100;
const MIN_SEGMENT_DISTANCE = 10;
const POLL_INTERVAL = 2000;

export function useLocationTracking() {
  const setError = useSetAtom(showErrorAtom);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [hike, setHike] = useState<ActiveHike>(defaultHikeState.hike);
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const applyState = useCallback((state: StoredHikeState) => {
    setHike(state.hike);
    setCurrentSegment(state.currentSegment);
    setIsTracking(state.isTracking);
  }, []);

  const syncFromStorage = useCallback(async () => {
    const state = await readHikeState();
    applyState(state);
  }, [applyState]);

  // On mount: restore any in-progress hike and listen to app state changes
  useEffect(() => {
    syncFromStorage();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncFromStorage();
      }
    });

    return () => {
      appStateSub.remove();
    };
  }, [syncFromStorage]);

  // Poll AsyncStorage while tracking so the UI stays up to date
  useEffect(() => {
    if (isTracking) {
      pollingRef.current = setInterval(syncFromStorage, POLL_INTERVAL);
    } else {
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
    const { status: fgPermission } = await Location.requestForegroundPermissionsAsync();
    if (fgPermission !== "granted") {
      setError("Permission to access location was denied.");
      return;
    }

    if (!__DEV__) {
      const { status: bgPermission } = await Location.requestBackgroundPermissionsAsync();
      if (bgPermission !== "granted") {
        setError("Permission to access background location was denied.");
        return;
      }
    }

    // Preserve paused hike data when resuming
    const existingState = await readHikeState();

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

    await writeHikeState(newState);

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

    applyState(newState);
  };

  const stopTracking = async () => {
    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // Read the latest state written by the background task
    const state = await readHikeState();
    const seg = state.currentSegment;

    let updatedHike = state.hike;

    if (seg) {
      const endTime = Date.now();
      const segmentDuration = endTime - seg.startTime;
      const completedSegment: Segment = { ...seg, endTime };

      if (completedSegment.distance >= MIN_SEGMENT_DISTANCE) {
        updatedHike = {
          ...state.hike,
          segments: [...state.hike.segments, completedSegment],
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
    const isTaskRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isTaskRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    await clearHikeState();
    applyState(defaultHikeState);
  };

  const getActiveTime = () => {
    const completedTime = hike.totalTime;
    if (!currentSegment) return completedTime;
    return completedTime + (Date.now() - currentSegment.startTime);
  };

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
