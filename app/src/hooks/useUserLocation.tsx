import { START_COORDINATE_BORAS } from "@/constants/constants";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";

export interface UserLocation {
  latitude: number;
  longitude: number;
  isFallback: boolean;
}

// Exported so that code which grants the permission *inside* the app can invalidate it.
// Neither of the query's own refresh triggers fires in that case: the app never
// backgrounds (no focus event) and tab screens stay mounted (no remount).
export const USER_LOCATION_KEY = ["userLocation"] as const;

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

// Whether we've already put the system dialog in front of the user this launch.
// Module-level, so it survives the query being refetched or the hook remounting.
let permissionAsked = false;

// This query refetches on every foreground return (useAppState wires AppState into React
// Query's focusManager), and requesting the permission backgrounds the app on Android —
// so an unconditional request here re-triggers the very focus event that refetches it.
// Hence: check the status every time, but prompt at most once per launch. A permission
// granted in Settings later is picked up by the status check, not by asking again.
async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (permissionAsked || !current.canAskAgain) return false;
  permissionAsked = true;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

async function fetchUserLocation(queryClient: QueryClient): Promise<UserLocation> {
  if (!(await ensureLocationPermission())) return BORAS_FALLBACK;

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

const FRESH_FIX_MS = 1000 * 60 * 10;

// The app's single source of truth for "where is the user". Screens that need a
// coordinate no matter what (the map, which must point its camera somewhere) read
// this directly and check isFallback; screens that show a distance or a place name
// want useRealUserLocation below instead.
export function useUserLocation() {
  const queryClient = useQueryClient();
  return useQuery<UserLocation>({
    queryKey: USER_LOCATION_KEY,
    queryFn: () => fetchUserLocation(queryClient),
    // A real fix keeps for ten minutes. The Borås fallback never does: it only records
    // that we couldn't ask, so it must be retried on the next foreground return — that
    // is how the app notices a permission granted in Settings while it was away.
    staleTime: (query) => (query.state.data?.isFallback ? 0 : FRESH_FIX_MS),
    retry: false,
  });
}

// The user's actual position, or null when we don't have one (permission denied, or
// no fix yet). Anything that would otherwise present Borås as "you" — distances in a
// card, "near me" filters, the hero's place name — must use this, so that "we don't
// know" renders as absence rather than as a plausible-looking wrong answer.
export function useRealUserLocation(): UserLocation | null {
  const { data } = useUserLocation();
  return data && !data.isFallback ? data : null;
}
