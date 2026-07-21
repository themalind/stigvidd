import { MIN_DISTANCE } from "@/services/location-task";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export interface LiveUserLocation {
  // [longitude, latitude] — MapLibre / GeoJSON coordinate order.
  position: GeoJSON.Position;
  // Horizontal accuracy radius in metres, or null when the platform omits it.
  accuracy: number | null;
  // Course over ground in degrees clockwise from north, or null when the user
  // isn't moving fast enough for it to be meaningful (see HEADING_MIN_SPEED).
  heading: number | null;
}

// Only trust the course-over-ground heading once the user is actually walking.
// Below this (metres/second) the reported course is noise: iOS returns -1 when
// stationary while Android can report a bogus 0 (due north), so gating on speed
// — not on the presence of a heading value — makes both platforms behave the same
// and stops the arrow spinning while you stand still. ~0.6 m/s is a slow amble.
const HEADING_MIN_SPEED = 0.6;

// Drives the follow-screen user puck from the app's own expo-location watcher
// instead of MapLibre's built-in <UserLocation> engine. That engine proved
// unreliable for live "follow me" tracking on both platforms: on iOS its
// CLLocationManager leaves pausesLocationUpdatesAutomatically at its YES default
// and never re-issues startUpdatingLocation, so it auto-pauses when idle and
// freezes; on Android MapLibre's default (non-fused) engine delivers an initial
// fix and then stops. In both cases the dot appears and then goes stale while you
// walk — exactly the reported bug.
//
// expo-location's watchPositionAsync only delivers while the app is foregrounded
// (per its docs) and iOS suspends JS in the background, so on every foreground
// return we both re-arm the watcher and pull one fresh fix — otherwise the puck
// stays frozen at the pre-pocket position, because the watcher is movement-gated
// (distanceInterval) and won't fire until you walk, and the last-known cache it
// would seed from is exactly that stale fix. Watcher accuracy is BestForNavigation
// to match the hike recorder (see use-location-tracking); coarser accuracies
// scatter the dot by tens of metres and make a walking track unusable.
export function useLiveUserLocation(enabled = true): LiveUserLocation | null {
  const [location, setLocation] = useState<LiveUserLocation | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // Bumped on every arm() so a slower, superseded arm (e.g. a mount arm still
    // awaiting when a foreground arm starts) can't install its watcher or write a
    // stale fix. Without it, overlapping arms leak native watchers that cleanup
    // never removes and let an old fix clobber a newer one.
    let generation = 0;

    const apply = ({ coords }: Location.LocationObject) => {
      if (!active) return;
      const moving = coords.speed != null && coords.speed >= HEADING_MIN_SPEED;
      const heading = moving && coords.heading != null && coords.heading >= 0 ? coords.heading : null;
      setLocation({ position: [coords.longitude, coords.latitude], accuracy: coords.accuracy, heading });
    };

    const arm = async () => {
      const myGeneration = ++generation;
      // Drop any watcher from a previous cycle up front so overlapping arms don't
      // race over the ref; a fresh one is installed below once we win the check.
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || !active || myGeneration !== generation) return;

        // Seed instantly from the last known fix so the puck appears without
        // waiting for a live update. This is a *cached* position with no maxAge,
        // so on a foreground resume it's often the pre-pocket location — hence the
        // fresh fix below; the seed is only a placeholder to avoid a blank puck.
        const last = await Location.getLastKnownPositionAsync();
        if (last && active && myGeneration === generation) apply(last);

        // Force a genuinely fresh one-shot fix. This is what actually refreshes the
        // puck on a foreground return: the movement-gated watcher below won't emit
        // until you walk MIN_DISTANCE (and iOS may have paused it while pocketed),
        // so without this the dot stays stuck on the stale cached seed until you
        // move. High (not BestForNavigation) so it lands in ~a second, not several.
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          .then((fresh) => {
            if (active && myGeneration === generation) apply(fresh);
          })
          .catch(() => {});

        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: MIN_DISTANCE },
          apply,
        );
        // If we tore down or were superseded while awaiting, remove immediately
        // instead of leaking it.
        if (active && myGeneration === generation) subscriptionRef.current = sub;
        else sub.remove();
      } catch {
        // A failed arm just leaves the last position in place; the trail still renders.
      }
    };

    arm();

    // Re-arm on foreground: the watcher stops delivering while backgrounded, and on
    // iOS JS is suspended entirely, so returning to the app needs a fresh watcher to
    // move the puck off its stale position.
    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") arm();
    });

    return () => {
      active = false;
      appStateSub.remove();
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [enabled]);

  return location;
}
