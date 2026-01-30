import { useRef, useState } from "react";
import * as Location from "expo-location";
import { LatLng } from "react-native-maps";
import { useSetAtom } from "jotai";
import { showErrorAtom } from "@/atoms/snackbar-atoms";

const SAMPLE_INTERVAL = 3000;

type LocationData = {
  coordinates: LatLng;
  timeStamp: number;
};

export function useLocationTracking() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const setError = useSetAtom(showErrorAtom);
  const [coordinates, setCoordinates] = useState<LocationData[]>([]);
  const [isTracking, setIsTracking] = useState(false);

  const startTracking = async () => {
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

    await recordPosition();

    intervalRef.current = setInterval(recordPosition, SAMPLE_INTERVAL);

    setIsTracking(true);
  };

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTracking(false);
  };

  const resetTracking = () => {
    setCoordinates([]);
  };

  const recordPosition = async () => {
    try {
      const location = await Location.getCurrentPositionAsync();

      setCoordinates((prev) => [
        ...prev,
        {
          coordinates: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          timeStamp: location.timestamp,
        },
      ]);
    } catch {
      stopTracking();
      setError("Lost access to location.");
    }
  };

  return { startTracking, stopTracking, resetTracking, isTracking, coordinates };
}
