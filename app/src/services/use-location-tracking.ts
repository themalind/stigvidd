import { showErrorAtom } from "@/atoms/snackbar-atoms";
import { Hike, LocationData, Segment } from "@/data/types";
import * as Location from "expo-location";
import { getDistance } from "geolib";
import { useSetAtom } from "jotai";
import { useCallback, useRef, useState } from "react";

const SAMPLE_INTERVAL = 3000;
const MIN_DISTANCE = 3;
const MAX_DISTANCE = 100;
const MAX_ACCURACY = 20;
const MIN_SEGMENT_DISTANCE = 10;

export function useLocationTracking() {
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const setError = useSetAtom(showErrorAtom);

  const [hike, setHike] = useState<Hike>({ segments: [], totalDistance: 0, totalTime: 0 });
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const startTracking = async () => {
    if (isTracking) {
      return;
    }

    const { status: fgPermission } = await Location.requestForegroundPermissionsAsync();
    if (fgPermission !== "granted") {
      setError("Permission to access location was denied.");
      return;
    }

    const { status: bgPermission } = await Location.requestBackgroundPermissionsAsync();
    if (bgPermission !== "granted") {
      setError("Permission to access backgroundLocation was denied.");
      return;
    }

    setCurrentSegment({
      coordinates: [],
      distance: 0,
      startTime: Date.now(),
    });

    locationSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: SAMPLE_INTERVAL,
        distanceInterval: MIN_DISTANCE,
      },
      handleLocationUpdate,
    );

    setIsTracking(true);
  };

  const stopTracking = () => {
    if (!isTracking) {
      return;
    }

    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }

    if (currentSegment) {
      const endTime = Date.now();
      const segmentDuration = endTime - currentSegment.startTime;

      const completedSegment: Segment = {
        ...currentSegment,
        endTime,
      };

      if (completedSegment.distance >= MIN_SEGMENT_DISTANCE) {
        setHike((prev) => ({
          ...prev,
          segments: [...prev.segments, completedSegment],
          totalTime: prev.totalTime + segmentDuration,
        }));
      }
    }

    setCurrentSegment(null);
    setIsTracking(false);
  };

  const resetTracking = () => {
    stopTracking();
    setHike({ segments: [], totalDistance: 0, totalTime: 0 });
  };

  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    setCurrentSegment((prev) => {
      if (!prev) {
        return prev;
      }

      if (!location.coords.accuracy) {
        return prev;
      }

      if (location.coords.accuracy > MAX_ACCURACY) {
        return prev;
      }

      const newPoint: LocationData = {
        data: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        timeStamp: location.timestamp,
      };

      const lastPoint = prev.coordinates.at(-1);
      let distanceToAdd = 0;

      if (lastPoint) {
        const distance = getDistance(lastPoint.data, newPoint.data);

        if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) {
          return prev;
        }

        distanceToAdd = distance;
      }

      if (distanceToAdd > 0) {
        setHike((h) => ({
          ...h,
          totalDistance: h.totalDistance + distanceToAdd,
        }));
      }

      return {
        ...prev,
        coordinates: [...prev.coordinates, newPoint],
        distance: prev.distance + distanceToAdd,
      };
    });
  }, []);

  const getActiveTime = () => {
    const completedTime = hike.totalTime;

    if (!currentSegment) {
      return completedTime;
    }

    return completedTime + (Date.now() - currentSegment.startTime);
  };

  const debugAddPoint = () => {
    setCurrentSegment((prev) => {
      if (!prev) {
        return prev;
      }

      const lastPoint = prev.coordinates.at(-1);
      const prevLng = lastPoint?.data.longitude ?? 12;
      const prevLat = lastPoint?.data.latitude ?? 57;

      let distanceToAdd = 0;

      const newPoint: LocationData = {
        data: {
          longitude: prevLng + (Math.random() - 0.5) * 0.0005,
          latitude: prevLat + (Math.random() - 0.5) * 0.0005,
        },
        timeStamp: Date.now(),
      };

      if (lastPoint) {
        const distance = getDistance(lastPoint.data, newPoint.data);

        if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) {
          return prev;
        }

        distanceToAdd = distance;
      }

      if (distanceToAdd > 0) {
        setHike((h) => ({
          ...h,
          totalDistance: h.totalDistance + distanceToAdd,
        }));
      }

      return {
        ...prev,
        coordinates: [...prev.coordinates, newPoint],
        distance: prev.distance + distanceToAdd,
      };
    });

    return null;
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
