// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { guardedNavigate } from "@/utils/navigation";
import { router } from "expo-router";

export function leaveEventScreen() {
  if (router.canGoBack()) router.back();
  else router.navigate("/(tabs)/events");
}

// Each stack that shows an event has its own copy of these routes, so a tap stays in that tab's history. keep-comment: the app's per-tab route pattern
export const EVENTS_TAB_ROUTES = {
  detail: "/(tabs)/events/event/[identifier]",
  trail: "/(tabs)/events/trail/[identifier]",
  trailFollow: "/(tabs)/events/follow/[identifier]",
  routeFollow: "/(tabs)/events/route/[identifier]",
  board: "/(tabs)/events/board/[identifier]",
  edit: "/(tabs)/events/edit/[identifier]",
} as const;

export const PROFILE_STACK_EVENT_ROUTES = {
  detail: "/(tabs)/(profile-stack)/event/[identifier]",
  trail: "/(tabs)/(profile-stack)/trail/[identifier]",
  trailFollow: "/(tabs)/(profile-stack)/follow/[identifier]",
  routeFollow: "/(tabs)/(profile-stack)/event-route/[identifier]",
  board: "/(tabs)/(profile-stack)/board/[identifier]",
  edit: "/(tabs)/(profile-stack)/event-edit/[identifier]",
} as const;

export type EventStackRoutes = typeof EVENTS_TAB_ROUTES | typeof PROFILE_STACK_EVENT_ROUTES;

export function openEvent(routes: EventStackRoutes, identifier: string) {
  guardedNavigate(() => router.navigate({ pathname: routes.detail, params: { identifier } }));
}
