import { START_COORDINATE_BORAS } from "@/constants/constants";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";

export interface UserLocation {
  latitude: number;
  longitude: number;
  isFallback: boolean;
}

const USER_LOCATION_KEY = ["userLocation"] as const;

const BORAS_FALLBACK: UserLocation = {
  latitude: START_COORDINATE_BORAS.latitude,
  longitude: START_COORDINATE_BORAS.longitude,
  isFallback: true,
};

function toUserLocation(pos: Location.LocationObject): UserLocation {
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, isFallback: false };
}

// Sharpen the fast last-known position with a fresh, precise fix and write it to the
// cache once it lands. Never downgrades to the fallback — a failed refine just leaves
// the last-known value in place.
async function refinePreciseLocation(queryClient: QueryClient): Promise<void> {
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    queryClient.setQueryData<UserLocation>(USER_LOCATION_KEY, toUserLocation(pos));
  } catch {
    // The precise fix is a nice-to-have; keep whatever we already returned.
  }
}

async function fetchUserLocation(queryClient: QueryClient): Promise<UserLocation> {
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") return BORAS_FALLBACK;

  // A cached fix returns almost instantly, so the camera glide and locate button
  // respond right away; we then refine to a fresh, precise fix in the background.
  const lastKnown = await Location.getLastKnownPositionAsync();
  if (lastKnown) {
    void refinePreciseLocation(queryClient);
    return toUserLocation(lastKnown);
  }

  // No cached fix yet (e.g. first run after enabling location) — wait for a fresh one.
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return toUserLocation(pos);
  } catch {
    return BORAS_FALLBACK;
  }
}

export function useUserLocation() {
  const queryClient = useQueryClient();
  return useQuery<UserLocation>({
    queryKey: USER_LOCATION_KEY,
    queryFn: () => fetchUserLocation(queryClient),
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}
