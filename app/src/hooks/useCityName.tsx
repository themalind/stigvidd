import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";

export interface UserLocation {
  latitude: number;
  longitude: number;
}
export function useCityName({ latitude, longitude }: UserLocation) {
  return useQuery({
    queryKey: ["reverseGeocode", latitude, longitude],
    queryFn: async () => {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: latitude,
        longitude: longitude,
      });
      // Fullösning, Expo location har inte stadsnamnet som en egen variabel i jsondatan.
      const fromAddress = place?.formattedAddress?.split(",")[1]?.replace(/\d+/g, "").trim();
      return place?.city ?? place?.district ?? place?.subregion ?? fromAddress ?? "Okänd plats";
    },
    enabled: latitude != null && longitude != null,
    staleTime: 1000 * 60 * 10,
    placeholderData: keepPreviousData,
  });
}
