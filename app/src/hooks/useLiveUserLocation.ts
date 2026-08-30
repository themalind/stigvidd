// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

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
// Below this the reported course is noise: iOS returns -1 when stationary while
// Android can report a bogus 0 (due north), so gating on speed — not on the presence
// of a heading value — makes both platforms behave the same and stops the arrow
// spinning while you stand still.
//
// Two thresholds, not one (metres/second): the arrow turns on above HEADING_ON_SPEED
// and only off again below HEADING_OFF_SPEED, with a dead band between. A single
// threshold sat right in the middle of ordinary GPS speed noise at walking pace, so
// the arrow flickered on and off several times a second — and each flip was a style
// change on the map, not just a repaint. ~0.8 m/s is a deliberate walk; ~0.4 m/s is
// slow enough to count as stopped.
const HEADING_ON_SPEED = 0.8;
const HEADING_OFF_SPEED = 0.4;

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
    // Whether this mount has already put the permission dialog up. See ensurePermission.
    let permissionAsked = false;

    // Only ever *queries* the permission on a re-arm. Requesting launches Android's
    // GrantPermissionsActivity, which pauses our activity — and the AppState listener
    // below re-arms as soon as it resumes, so an unconditional request here feeds
    // itself: dialog -> pause -> resume -> dialog. That livelocked the app on a real
    // device (203 GrantPermissionsActivity launches in 30 s, the screen flickering the
    // whole time) whenever the grant wasn't already permanent — e.g. Android's
    // "Ask every time" / one-time location access, which re-prompts on every request.
    // useUserLocation already asks once per launch on the first screen that needs a
    // position; asking here is only a fallback for a one-time grant that expired, so
    // once per mount is enough.
    const ensurePermission = async (): Promise<boolean> => {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.granted) return true;
      // Nothing to gain from prompting: either we already did this mount, or the user
      // has denied it permanently and only Settings can change it.
      if (permissionAsked || !current.canAskAgain) return false;
      permissionAsked = true;
      const requested = await Location.requestForegroundPermissionsAsync();
      return requested.granted;
    };

    // Which side of the hysteresis band we're currently on. Lives across fixes for the
    // whole mount — deliberately not reset by a foreground re-arm, so pocketing the
    // phone mid-walk doesn't drop the arrow.
    let movingNow = false;

    const apply = ({ coords }: Location.LocationObject) => {
      if (!active) return;
      // A missing speed reads as stopped, which is the safe direction: no arrow.
      const speed = coords.speed ?? -1;
      movingNow = movingNow ? speed >= HEADING_OFF_SPEED : speed >= HEADING_ON_SPEED;
      const heading = movingNow && coords.heading != null && coords.heading >= 0 ? coords.heading : null;
      setLocation({ position: [coords.longitude, coords.latitude], accuracy: coords.accuracy, heading });
    };

    const arm = async () => {
      const myGeneration = ++generation;
      // Drop any watcher from a previous cycle up front so overlapping arms don't
      // race over the ref; a fresh one is installed below once we win the check.
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      try {
        const granted = await ensurePermission();
        if (!granted || !active || myGeneration !== generation) return;

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
