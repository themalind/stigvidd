import { atom } from "jotai";
import { LatLng } from "react-native-maps";

export const userLocationAtom = atom<LatLng | null>(null);
export const locationResolvedAtom = atom(false);
