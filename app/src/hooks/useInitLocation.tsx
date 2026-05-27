import { userLocationAtom } from "@/atoms/location-atoms";
import * as Location from "expo-location";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

export function useInitLocation() {
  const setUserLocation = useSetAtom(userLocationAtom);

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
        }
      } catch (e) {
        console.log("Kunde inte hämta position:", e);
      }
    };

    fetchLocation();
  }, [setUserLocation]);
}
