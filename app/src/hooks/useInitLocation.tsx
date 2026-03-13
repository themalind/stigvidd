import { locationResolvedAtom, userLocationAtom } from "@/atoms/location-atoms";
import * as Location from "expo-location";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { AppState } from "react-native";

export function useInitLocation() {
  const setUserLocation = useSetAtom(userLocationAtom);
  const setLocationResolved = useSetAtom(locationResolvedAtom);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        } else {
          // Rensa positionen om tillstånd saknas
          setUserLocation(null);
        }
      } catch (e) {
        console.log("Kunde inte hämta position:", e);
      } finally {
        setLocationResolved(true);
      }
    };

    fetchLocation();

    // Lyssna på när appen kommer tillbaka i förgrunden
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        fetchLocation();
      }
    });

    return () => sub.remove();
  }, [setUserLocation, setLocationResolved]);
}
