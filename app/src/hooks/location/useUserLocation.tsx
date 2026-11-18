// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { START_COORDINATE_BORAS } from "@/constants/constants";
import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { getConsentSync, isConsentHydrated, subscribeConsent } from "@/services/consent";
import { useEffect } from "react";
import * as Location from "expo-location";

export interface UserLocation {
  latitude: number;
  longitude: number;
  isFallback: boolean;
}

// keep-comment: an in-app grant must invalidate this; no focus event or remount happens then
export const USER_LOCATION_KEY = ["userLocation"] as const;

const BORAS_FALLBACK: UserLocation = {
  latitude: START_COORDINATE_BORAS.latitude,
  longitude: START_COORDINATE_BORAS.longitude,
  isFallback: true,
};

function toUserLocation(pos: Location.LocationObject): UserLocation {
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, isFallback: false };
}

async function refinePreciseLocation(queryClient: QueryClient): Promise<void> {
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    queryClient.setQueryData<UserLocation>(USER_LOCATION_KEY, toUserLocation(pos));
  } catch {
    // keep-comment: a failed refine keeps the last-known fix, never the fallback
  }
}

function startupDialogIsUp(): boolean {
  return !isConsentHydrated() || getConsentSync() === "unknown";
}

// keep-comment: module level, so it survives refetches and remounts
let permissionAsked = false;

// keep-comment: prompts at most once per launch: the query refetches on focus, and the Android
// keep-comment: dialog backgrounds the app, so an unconditional request loops on its own focus event
async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  // keep-comment: never over the consent dialog; useReleaseOnConsent refetches after it
  if (startupDialogIsUp()) return false;
  if (permissionAsked || !current.canAskAgain) return false;
  permissionAsked = true;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

async function fetchUserLocation(queryClient: QueryClient): Promise<UserLocation> {
  if (!(await ensureLocationPermission())) return BORAS_FALLBACK;

  const lastKnown = await Location.getLastKnownPositionAsync();
  if (lastKnown) {
    void refinePreciseLocation(queryClient);
    return toUserLocation(lastKnown);
  }

  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return toUserLocation(pos);
  } catch {
    return BORAS_FALLBACK;
  }
}

const FRESH_FIX_MS = 1000 * 60 * 10;

function useReleaseOnConsent(queryClient: QueryClient): void {
  useEffect(() => {
    if (!startupDialogIsUp()) return;

    const unsubscribe = subscribeConsent(() => {
      if (startupDialogIsUp()) return;
      unsubscribe();
      void queryClient.invalidateQueries({ queryKey: USER_LOCATION_KEY });
    });

    return unsubscribe;
  }, [queryClient]);
}

// keep-comment: for a coordinate no matter what (the map camera); distances and place names use useRealUserLocation
export function useUserLocation() {
  const queryClient = useQueryClient();
  useReleaseOnConsent(queryClient);
  return useQuery<UserLocation>({
    queryKey: USER_LOCATION_KEY,
    queryFn: () => fetchUserLocation(queryClient),
    // keep-comment: the fallback is never fresh, so a foreground return notices a grant made in Settings
    staleTime: (query) => (query.state.data?.isFallback ? 0 : FRESH_FIX_MS),
    retry: false,
  });
}

// keep-comment: null rather than Borås, so "unknown" shows as absence, not a plausible wrong answer
export function useRealUserLocation(): UserLocation | null {
  const { data } = useUserLocation();
  return data && !data.isFallback ? data : null;
}
