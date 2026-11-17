// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { readHikeState } from "@/services/location-task";
import { logger } from "@/services/logger";
import { usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

export type HikeInProgress = { status: "recording" | "paused"; distance: number } | null;

export const HIKE_IN_PROGRESS_POLL_MS = 5000;

async function readInProgress(): Promise<HikeInProgress> {
  const { isTracking, currentSegment, hike } = await readHikeState();
  if (isTracking) return { status: "recording", distance: hike.totalDistance };
  if (currentSegment || hike.segments.length > 0) return { status: "paused", distance: hike.totalDistance };
  return null;
}

// Re-read on every navigation, since a recording starts and stops on the recorder screen. keep-comment: why the pathname is a dependency
export function useHikeInProgress(enabled: boolean): HikeInProgress {
  const pathname = usePathname();
  const [inProgress, setInProgress] = useState<HikeInProgress>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const refresh = () => {
      readInProgress()
        .then((next) => {
          if (active) setInProgress(next);
        })
        .catch((error: unknown) => logger.warn("Reading the hike in progress failed", { errorMessage: String(error) }));
    };

    refresh();
    const interval = setInterval(refresh, HIKE_IN_PROGRESS_POLL_MS);
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });

    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, pathname]);

  return enabled ? inProgress : null;
}
