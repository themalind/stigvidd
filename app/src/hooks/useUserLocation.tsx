import { START_COORDINATE_BORAS } from "@/constants/constants";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";

export interface UserLocation {
  latitude: number;
  longitude: number;
  isFallback: boolean;
}

async function fetchUserLocation(): Promise<UserLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    return {
      latitude: START_COORDINATE_BORAS.latitude,
      longitude: START_COORDINATE_BORAS.longitude,
      isFallback: true,
    };
  }

  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      isFallback: false,
    };
  } catch {
    return {
      latitude: START_COORDINATE_BORAS.latitude,
      longitude: START_COORDINATE_BORAS.longitude,
      isFallback: true,
    };
  }
}

export function useUserLocation() {
  return useQuery<UserLocation>({
    queryKey: ["userLocation"],
    queryFn: fetchUserLocation,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}
