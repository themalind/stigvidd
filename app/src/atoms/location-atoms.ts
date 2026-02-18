import { atom } from "jotai";

interface UserLocation {
  latitude: number;
  longitude: number;
}

export const userLocationAtom = atom<UserLocation | null>(null);
export const locationResolvedAtom = atom(false);
