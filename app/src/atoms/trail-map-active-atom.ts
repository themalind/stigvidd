import { atom } from "jotai";

// True when any secondary MapView is active (trail map, hike detail modal, shared hike modal).
// TrailMarkersMap pauses its MapView to avoid running multiple instances simultaneously.
export const secondaryMapActiveAtom = atom(false);
