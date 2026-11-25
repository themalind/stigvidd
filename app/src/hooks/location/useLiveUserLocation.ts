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
  // [longitude, latitude] keep-comment: GeoJSON order, easy to swap
  position: GeoJSON.Position;
  accuracy: number | null;
  // Degrees from north; null below walking speed. keep-comment: unit and null meaning
  heading: number | null;
}

// keep-comment: gated on speed, not on a heading value: iOS reports -1 and Android a bogus 0 when still
// keep-comment: two thresholds (m/s) with a dead band, since one sits inside GPS speed noise and
// keep-comment: flickers the arrow, each flip being a map style change
const HEADING_ON_SPEED = 0.8;
const HEADING_OFF_SPEED = 0.4;

// keep-comment: not MapLibre's <UserLocation>: on iOS it auto-pauses and freezes, on Android it stops after one fix
// keep-comment: the watcher only delivers in the foreground and is movement-gated, so every foreground
// keep-comment: return re-arms it and takes one fresh fix, or the puck stays at the pre-pocket position
// keep-comment: BestForNavigation like the recorder; coarser accuracies scatter the dot by tens of metres
export function useLiveUserLocation(enabled = true): LiveUserLocation | null {
  const [location, setLocation] = useState<LiveUserLocation | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // keep-comment: a superseded arm must not install its watcher (it leaks) or write an older fix
    let generation = 0;
    let permissionAsked = false;

    // keep-comment: asks at most once per mount: the dialog pauses the activity, the AppState listener
    // keep-comment: re-arms on resume, and an unconditional request livelocks Android ("Ask every time")
    const ensurePermission = async (): Promise<boolean> => {
      const current = await Location.getForegroundPermissionsAsync();
      if (current.granted) return true;
      if (permissionAsked || !current.canAskAgain) return false;
      permissionAsked = true;
      const requested = await Location.requestForegroundPermissionsAsync();
      return requested.granted;
    };

    // keep-comment: not reset by a re-arm, so pocketing the phone mid-walk keeps the arrow
    let movingNow = false;

    const apply = ({ coords }: Location.LocationObject) => {
      if (!active) return;
      const speed = coords.speed ?? -1;
      movingNow = movingNow ? speed >= HEADING_OFF_SPEED : speed >= HEADING_ON_SPEED;
      const heading = movingNow && coords.heading != null && coords.heading >= 0 ? coords.heading : null;
      setLocation({ position: [coords.longitude, coords.latitude], accuracy: coords.accuracy, heading });
    };

    const arm = async () => {
      const myGeneration = ++generation;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      try {
        const granted = await ensurePermission();
        if (!granted || !active || myGeneration !== generation) return;

        // keep-comment: a placeholder only, often the pre-pocket position, hence the fresh fix below
        const last = await Location.getLastKnownPositionAsync();
        if (last && active && myGeneration === generation) apply(last);

        // keep-comment: High, not BestForNavigation, so it lands in about a second
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          .then((fresh) => {
            if (active && myGeneration === generation) apply(fresh);
          })
          .catch(() => {});

        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: MIN_DISTANCE },
          apply,
        );
        if (active && myGeneration === generation) subscriptionRef.current = sub;
        else sub.remove();
      } catch {
        // keep-comment: a failed arm keeps the last position
      }
    };

    void arm();

    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active") void arm();
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
