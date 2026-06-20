import { START_COORDINATE_BORAS } from "@/constants/constants";
import { LatLng } from "@/data/types";
import { atom } from "jotai";

export const userLocationAtom = atom<LatLng | null>({
  latitude: START_COORDINATE_BORAS.latitude,
  longitude: START_COORDINATE_BORAS.longitude,
});
export const locationResolvedAtom = atom(true);
