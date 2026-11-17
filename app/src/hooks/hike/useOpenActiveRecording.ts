// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { readHikeState } from "@/services/location-task";
import { logger } from "@/services/logger";
import { router, useNavigationContainerRef, usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

export const RECORDER_ROUTE = "/(tabs)/(profile-stack)/user/create-hike";
export const RECORDER_PATH = "/user/create-hike";

// Shorter trips out (camera, image picker, settings) return to the screen they left. keep-comment: why a threshold, not every return
export const AWAY_BEFORE_RECORDER_MS = 60_000;

// About two seconds. keep-comment: a navigator that never readies must not hold the check forever
const MAX_FRAMES_TO_READY = 120;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// The recording notification opens the app without saying so, so any open during a recording leads back to it. keep-comment: docs/notes/android-recording-survives-process-restart.md
export function useOpenActiveRecording(signedIn: boolean) {
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  const navigation = useNavigationContainerRef();

  useEffect(() => {
    currentPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;

    const openIfRecording = async () => {
      try {
        const { isTracking } = await readHikeState();
        if (!isTracking || !active) return;
        for (let frame = 0; frame < MAX_FRAMES_TO_READY && !navigation.isReady(); frame++) await nextFrame();
        if (!active || !navigation.isReady() || currentPath.current === RECORDER_PATH) return;
        router.navigate(RECORDER_ROUTE, { withAnchor: true });
      } catch (error) {
        logger.error("Opening the active recording failed", { errorMessage: String(error) });
      }
    };

    void openIfRecording();

    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt = Date.now();
        return;
      }
      if (next !== "active" || backgroundedAt === null) return;
      const away = Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (away >= AWAY_BEFORE_RECORDER_MS) void openIfRecording();
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [signedIn, navigation]);
}
