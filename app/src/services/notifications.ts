// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { registerPushToken, unregisterPushToken } from "@/api/notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";
import * as Device from "expo-device";
import type { EventSubscription } from "expo";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { logger } from "./logger";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// The backend's PushTypes, which send these as data.type. keep-comment: the two lists must match by hand
export type PushType =
  | "friend_request"
  | "friend_request_accepted"
  | "hike_share"
  | "event_cancelled"
  | "event_updated"
  | "event_promoted"
  | "event_invite"
  | "event_post";

export type PushData = Record<string, unknown>;

export interface NotificationHandler {
  queryKeys: (data: PushData) => unknown[][];
  route: (data: PushData) => string | undefined;
  routeBeneath?: (data: PushData) => string | undefined;
}

export const NOTIFICATION_HANDLERS: Record<PushType, NotificationHandler> = {
  friend_request: {
    queryKeys: () => [["friends", "incoming"]],
    route: () => "/(tabs)/(profile-stack)/user/friends",
  },
  friend_request_accepted: {
    queryKeys: () => [["friends"]],
    route: () => "/(tabs)/(profile-stack)/user/friends",
  },
  hike_share: {
    queryKeys: () => [["shared-hikes"]],
    route: () => "/(tabs)/(profile-stack)/user/shared-hikes",
  },
  event_cancelled: {
    queryKeys: () => [["events"]],
    route: (data) => eventRoute(data, "event"),
  },
  event_updated: {
    queryKeys: () => [["events"]],
    route: (data) => eventRoute(data, "event"),
  },
  event_promoted: {
    queryKeys: () => [["events"]],
    route: (data) => eventRoute(data, "event"),
  },
  event_invite: {
    queryKeys: (data) =>
      forEvent(data, (id) => [
        ["events", "invitations"],
        ["events", "detail", id],
      ]),
    route: (data) => eventRoute(data, "event"),
  },
  // A post changes one board and the unread counts on the event cards. keep-comment: why not every event query
  event_post: {
    queryKeys: (data) =>
      forEvent(data, (id) => [
        ["events", "board", id],
        ["events", "mine"],
        ["events", "feed"],
      ]),
    route: (data) => eventRoute(data, "board"),
    routeBeneath: (data) => eventRoute(data, "event"),
  },
};

function eventIdentifier(data: PushData): string | undefined {
  const identifier = data.eventIdentifier;
  return typeof identifier === "string" && identifier !== "" ? identifier : undefined;
}

// Without an identifier every event query is refreshed. keep-comment: a malformed push still redraws what it may have changed
function forEvent(data: PushData, keys: (identifier: string) => unknown[][]): unknown[][] {
  const identifier = eventIdentifier(data);
  return identifier ? keys(identifier) : [["events"]];
}

function eventRoute(data: PushData, screen: "event" | "board"): string | undefined {
  const identifier = eventIdentifier(data);
  if (!identifier) return undefined;
  return `/(tabs)/events/${screen}/${encodeURIComponent(identifier)}`;
}

export function invalidateForPush(queryClient: QueryClient, handler: NotificationHandler, data: PushData): void {
  for (const queryKey of handler.queryKeys(data)) void queryClient.invalidateQueries({ queryKey });
}

export function isPushType(type: unknown): type is PushType {
  return typeof type === "string" && Object.hasOwn(NOTIFICATION_HANDLERS, type);
}

export function notificationHandlerFor(data: PushData | undefined): NotificationHandler | undefined {
  const type = data?.type;
  return isPushType(type) ? NOTIFICATION_HANDLERS[type] : undefined;
}

const HANDLED_RESPONSES_KEY = "@stigvidd_handled_notifications";
const HANDLED_RESPONSES_KEPT = 200;

function parseHandledIds(stored: string | null): string[] {
  if (stored === null) return [];
  let handled: unknown;
  try {
    handled = JSON.parse(stored);
  } catch {
    handled = undefined;
  }
  if (Array.isArray(handled)) return handled.filter((id): id is string => typeof id === "string");
  logger.warn("Handled notification list unreadable, starting over");
  return [];
}

// Changes to the list run one at a time: two concurrent read-modify-writes would drop one of the ids. keep-comment: hidden race
let claimQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = claimQueue.then(work);
  claimQueue = next.catch(() => undefined);
  return next;
}

// Android restores a killed app with the intent that first opened it, so an old tap comes back as new. keep-comment: hidden platform behaviour
export function claimNotificationResponse(identifier: string): Promise<boolean> {
  return enqueue(() => claimNext(identifier));
}

// A claimed tap that was never opened is given back, so the next sign-in or launch opens it. keep-comment: why a claim can be undone
export function releaseNotificationResponse(identifier: string): Promise<void> {
  return enqueue(async () => {
    try {
      const ids = parseHandledIds(await AsyncStorage.getItem(HANDLED_RESPONSES_KEY));
      await AsyncStorage.setItem(HANDLED_RESPONSES_KEY, JSON.stringify(ids.filter((id) => id !== identifier)));
    } catch (error) {
      logger.warn("Notification tap bookkeeping failed", { errorMessage: String(error) });
    }
  });
}

async function claimNext(identifier: string): Promise<boolean> {
  let isNew = true;
  try {
    const ids = parseHandledIds(await AsyncStorage.getItem(HANDLED_RESPONSES_KEY));
    isNew = !ids.includes(identifier);
    if (ids[0] === identifier) return isNew;
    // A replayed tap moves to the front, so the one Android keeps replaying is never the one dropped. keep-comment: why a seen id is written again
    const kept = [identifier, ...ids.filter((id) => id !== identifier)].slice(0, HANDLED_RESPONSES_KEPT);
    await AsyncStorage.setItem(HANDLED_RESPONSES_KEY, JSON.stringify(kept));
  } catch (error) {
    logger.warn("Notification tap bookkeeping failed", { errorMessage: String(error) });
  }
  return isNew;
}

let _currentExpoToken: string | null = null;
let _tokenListener: EventSubscription | null = null;

// keep-comment: safe on every launch
export async function registerForPushNotificationsAsync(): Promise<void> {
  // keep-comment: Android needs the channel before the permission request
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      // eslint-disable-next-line import/namespace -- the rule cannot follow expo-notifications' re-exported enum
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // keep-comment: simulators have no APNs/FCM identity and throw past this point
  if (!Device.isDevice) {
    logger.debug("Push registration skipped — not a physical device");
    return;
  }

  // keep-comment: iOS shows the system dialog only once
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    logger.info("Push registration declined by user");
    return;
  }

  // keep-comment: the EAS project, which picks the APNs/FCM credentials
  const projectId = "f436d9c7-ff9c-4a60-b51f-1aefd5672205";

  // keep-comment: a network failure at exp.host is retried next launch, not thrown
  let expoToken: string;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    expoToken = data;
  } catch (error) {
    logger.warn("Could not fetch Expo push token", { errorMessage: String(error) });
    return;
  }
  _currentExpoToken = expoToken;

  await registerPushToken(expoToken, Platform.OS);

  // keep-comment: re-registers on rotation; the old listener goes first, or login cycles stack them
  _tokenListener?.remove();
  _tokenListener = Notifications.addPushTokenListener(({ data: newToken }) => {
    _currentExpoToken = newToken;
    registerPushToken(newToken, Platform.OS).catch((error: unknown) =>
      logger.error("Re-registering a rotated push token failed", { errorMessage: String(error) }),
    );
  });
}

export async function unregisterForPushNotificationsAsync(): Promise<void> {
  _tokenListener?.remove();
  _tokenListener = null;

  if (_currentExpoToken) {
    await unregisterPushToken(_currentExpoToken);
    _currentExpoToken = null;
  }
}
