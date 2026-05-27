import { START_COORDINATE_BORAS } from "@/constants/constants";
import { atom } from "jotai";
import { LatLng } from "react-native-maps";

export const userLocationAtom = atom<LatLng | null>({
  latitude: START_COORDINATE_BORAS.latitude,
  longitude: START_COORDINATE_BORAS.longitude,
});
export const locationResolvedAtom = atom(true);
