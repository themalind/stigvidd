// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { NOTIFICATION_HANDLERS, type PushType } from "@/services/notifications";
import { openPushRoute } from "@/services/open-push-route";
import { Stack, Tabs, router } from "expo-router";
import { store } from "expo-router/build/global-state/router-store";
import { act, renderRouter } from "expo-router/testing-library";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import EventsStackLayout, * as eventsLayout from "../(tabs)/events/_layout";
import ProfileStackLayout, * as profileLayout from "../(tabs)/(profile-stack)/_layout";

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));

function page(label: string) {
  return function Page() {
    return <Text>{label}</Text>;
  };
}

const PROFILE_SCREENS = [
  "login",
  "register",
  "verify-email",
  "profile-page",
  "about",
  "trail/[identifier]",
  "follow/[identifier]",
  "guide",
  "hike/[identifier]",
  "shared-hike/[identifier]",
  "hike-follow/[identifier]",
  "event/[identifier]",
  "board/[identifier]",
  "event-route/[identifier]",
  "event-edit/[identifier]",
  "user/favorites",
  "user/wishlist",
  "user/my-hikes",
  "user/published-hikes",
  "user/create-hike",
  "user/shared-hikes",
  "user/friends",
  "user/friend/[identifier]",
];

const EVENT_SCREENS = [
  "index",
  "event/[identifier]",
  "board/[identifier]",
  "trail/[identifier]",
  "follow/[identifier]",
  "route/[identifier]",
  "create",
  "edit/[identifier]",
  "guide",
];

// Like the app's root layout, it draws nothing until startup is done, and a tap is opened after that. keep-comment: reproduces the cold-start order
function GatedRoot({ onReady }: { onReady?: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) void Promise.resolve().then(() => onReady?.());
  }, [ready, onReady]);
  if (!ready) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}

async function renderApp(onReady?: () => void) {
  const app = renderRouter(
    {
      _layout: () => <GatedRoot onReady={onReady} />,
      "(tabs)/_layout": () => <Tabs />,
      "(tabs)/(home)/_layout": () => <Stack />,
      "(tabs)/(home)/index": page("Start"),
      "(tabs)/(profile-stack)/_layout": { ...profileLayout, default: ProfileStackLayout },
      ...Object.fromEntries(PROFILE_SCREENS.map((name) => [`(tabs)/(profile-stack)/${name}`, page(name)])),
      "(tabs)/events/_layout": { ...eventsLayout, default: EventsStackLayout },
      ...Object.fromEntries(EVENT_SCREENS.map((name) => [`(tabs)/events/${name}`, page(name)])),
    },
    { initialUrl: "/" },
  );
  // renderRouter turns on fake timers, under which the frame between two navigates never comes. keep-comment: hidden test-kit behaviour
  jest.useRealTimers();
  await act(async () => {});
  await act(async () => {});
  return app;
}

function pushTo(type: PushType, eventIdentifier: string, currentPath: string) {
  return openPushRoute(NOTIFICATION_HANDLERS[type], { type, eventIdentifier }, currentPath);
}

// Started outside act, which would hold back the render a tab has to mount in between the two navigates. keep-comment: inside act the frame wait proves nothing
async function tap(type: PushType, eventIdentifier: string, currentPath: string) {
  const opened = pushTo(type, eventIdentifier, currentPath);
  await act(async () => {
    await opened;
  });
}

type NavigationLevel = {
  index?: number;
  routes: { name: string; state?: NavigationLevel; params?: { identifier?: string } }[];
};

function focusedTabStack(): string[] {
  let level = store.state as unknown as NavigationLevel | undefined;
  while (level) {
    const focused: NavigationLevel["routes"][number] = level.routes[level.index ?? level.routes.length - 1];
    if (focused.name === "events" || focused.name === "(profile-stack)") {
      return (focused.state?.routes ?? []).map((route) =>
        route.params?.identifier ? `${route.name}=${route.params.identifier}` : route.name,
      );
    }
    level = focused.state;
  }
  throw new Error("expected a focused tab stack");
}

const EVENT_DETAIL_STACK = ["index", "event/[identifier]=ev1"];
const BOARD_STACK = ["index", "event/[identifier]=ev1", "board/[identifier]=ev1"];

const ROUTES: [PushType, string, string[], string][] = [
  ["friend_request", "/user/friends", ["profile-page", "user/friends"], "/profile-page"],
  ["friend_request_accepted", "/user/friends", ["profile-page", "user/friends"], "/profile-page"],
  ["hike_share", "/user/shared-hikes", ["profile-page", "user/shared-hikes"], "/profile-page"],
  ["event_cancelled", "/events/event/ev1", EVENT_DETAIL_STACK, "/events"],
  ["event_updated", "/events/event/ev1", EVENT_DETAIL_STACK, "/events"],
  ["event_promoted", "/events/event/ev1", EVENT_DETAIL_STACK, "/events"],
  ["event_invite", "/events/event/ev1", EVENT_DETAIL_STACK, "/events"],
  ["event_post", "/events/board/ev1", BOARD_STACK, "/events/event/ev1"],
];

it("has a row for every push type", () => {
  expect(ROUTES.map(([type]) => type).sort()).toEqual(Object.keys(NOTIFICATION_HANDLERS).sort());
});

describe.each(ROUTES)("%s", (type, path, stack, backTo) => {
  it("opens over the tab's first screen from a running app", async () => {
    const app = await renderApp();

    await tap(type, "ev1", "/");

    expect(app.getPathname()).toBe(path);
    expect(focusedTabStack()).toEqual(stack);
    act(() => router.back());
    expect(app.getPathname()).toBe(backTo);
  });

  it("opens over the tab's first screen on a cold start", async () => {
    let opened: Promise<void> | undefined;
    const app = await renderApp(() => {
      opened = pushTo(type, "ev1", "/");
    });
    await act(async () => {
      await opened;
    });

    expect(app.getPathname()).toBe(path);
    expect(focusedTabStack()).toEqual(stack);
  });
});

it("walks back from a tapped board post through the event and the list, then out of the tab", async () => {
  const app = await renderApp();

  await tap("event_post", "ev1", "/");
  act(() => router.back());
  expect(app.getPathname()).toBe("/events/event/ev1");
  act(() => router.back());
  expect(app.getPathname()).toBe("/events");
  act(() => router.back());
  expect(app.getPathname()).toBe("/");
});

it("adds nothing when the tapped board is already open", async () => {
  const app = await renderApp();
  await tap("event_post", "ev1", "/");

  await tap("event_post", "ev1", app.getPathname());

  expect(focusedTabStack()).toEqual(BOARD_STACK);
});

it("adds only the board when the post's event is already open", async () => {
  const app = await renderApp();
  await tap("event_invite", "ev1", "/");

  await tap("event_post", "ev1", app.getPathname());

  expect(focusedTabStack()).toEqual(BOARD_STACK);
});

it("keeps the board the user was reading beneath a post for another event", async () => {
  const app = await renderApp();
  await tap("event_post", "A", "/");

  await tap("event_post", "B", app.getPathname());

  expect(app.getPathname()).toBe("/events/board/B");
  act(() => router.back());
  expect(app.getPathname()).toBe("/events/event/B");
  act(() => router.back());
  expect(app.getPathname()).toBe("/events/board/A");
});

it("keeps an open event beneath a tap for another event", async () => {
  const app = await renderApp();
  await tap("event_invite", "A", "/");

  await tap("event_invite", "B", app.getPathname());

  expect(app.getPathname()).toBe("/events/event/B");
  act(() => router.back());
  expect(app.getPathname()).toBe("/events/event/A");
});

it("opens over the list when the events tab was visited earlier", async () => {
  const app = await renderApp();
  act(() => router.navigate("/(tabs)/events"));
  act(() => router.navigate("/(tabs)/(home)"));

  await tap("event_updated", "ev1", app.getPathname());

  expect(focusedTabStack()).toEqual(EVENT_DETAIL_STACK);
});
