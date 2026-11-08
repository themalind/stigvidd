// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { router } from "expo-router";
import type { NotificationHandler, PushData } from "./notifications";

function navigateAnchored(route: string) {
  router.navigate(route as never, { withAnchor: true });
}

function pathOf(route: string): string {
  return decodeURIComponent(route.replace(/\/\([^/]+\)/g, ""));
}

type NavigationLevel = {
  index?: number;
  routes: { params?: object; state?: NavigationLevel }[];
};

export type PushNavigation = {
  currentPath: () => string;
  rootState: () => unknown;
};

// About two seconds. keep-comment: a screen that never lands must not swallow the tap
const MAX_FRAMES_TO_LAND = 120;

// A navigator that has not mounted holds its target in the params of the route above it.
function hasMountedTarget(root: unknown): boolean {
  let level = root as NavigationLevel | undefined;
  while (level) {
    const focused = level.routes[level.index ?? level.routes.length - 1];
    if (!focused.state) return !focused.params || !("screen" in focused.params);
    level = focused.state;
  }
  return false;
}

async function untilLanded(path: string, navigation: PushNavigation) {
  for (let frame = 0; frame < MAX_FRAMES_TO_LAND; frame++) {
    if (navigation.currentPath() === path && hasMountedTarget(navigation.rootState())) return;
    await nextFrame();
  }
}

// Without the anchor, a tab that has not mounted gets only this screen: back leaves the tab and a tab press does nothing. keep-comment: docs/notes/router-push-into-unmounted-tab-has-no-back.md
export async function openPushRoute(
  handler: NotificationHandler,
  data: PushData,
  navigation: PushNavigation,
): Promise<void> {
  const route = handler.route(data);
  if (!route) return;
  const beneath = handler.routeBeneath?.(data);
  // The target already open has what it had beneath it, and a screen on top would add a copy of the target. keep-comment: why the current path is checked
  if (beneath && pathOf(route) !== navigation.currentPath()) {
    navigateAnchored(beneath);
    // A tab that has not mounted keeps only the latest navigate, so the first must land before the second. keep-comment: measured, a fixed frame loses the event under load
    await untilLanded(pathOf(beneath), navigation);
  }
  navigateAnchored(route);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
