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

// Without the anchor, a tab that has not mounted gets only this screen: back leaves the tab and a tab press does nothing. keep-comment: docs/notes/router-push-into-unmounted-tab-has-no-back.md
export async function openPushRoute(handler: NotificationHandler, data: PushData, currentPath: string): Promise<void> {
  const route = handler.route(data);
  if (!route) return;
  const beneath = handler.routeBeneath?.(data);
  // The target already open has what it had beneath it, and a screen on top would add a copy of the target. keep-comment: why the current path is checked
  if (beneath && pathOf(route) !== currentPath) {
    navigateAnchored(beneath);
    // A tab that has not mounted keeps only the latest navigate, so the first must land before the second. keep-comment: measured, two in a row lose the event
    await nextFrame();
  }
  navigateAnchored(route);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
