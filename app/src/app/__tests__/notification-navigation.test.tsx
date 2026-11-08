// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { NOTIFICATION_HANDLERS, type PushType } from "@/services/notifications";
import { openPushRoute } from "@/services/open-push-route";
import { Stack, Tabs, router } from "expo-router";
import { act, renderRouter, type RenderRouterResult } from "expo-router/testing-library";
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
function GatedRoot({ startup, onReady }: { startup: Promise<void>; onReady?: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void startup.then(() => setReady(true));
  }, [startup]);
  useEffect(() => {
    if (ready) void Promise.resolve().then(() => onReady?.());
  }, [ready, onReady]);
  if (!ready) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}

async function renderApp(onReady?: () => void) {
  let finishStartup = () => {};
  const startup = new Promise<void>((resolve) => {
    finishStartup = resolve;
  });
  const app = await renderRouter(
    {
      _layout: () => <GatedRoot startup={startup} onReady={onReady} />,
      "(tabs)/_layout": () => (
        <Tabs>
          <Tabs.Screen name="(home)" />
          <Tabs.Screen name="(profile-stack)" />
          <Tabs.Screen name="events" />
        </Tabs>
      ),
      "(tabs)/(home)/_layout": () => <Stack />,
      "(tabs)/(home)/index": page("Start"),
      "(tabs)/(profile-stack)/_layout": { ...profileLayout, default: ProfileStackLayout },
      ...Object.fromEntries(PROFILE_SCREENS.map((name) => [`(tabs)/(profile-stack)/${name}`, page(name)])),
      "(tabs)/events/_layout": { ...eventsLayout, default: EventsStackLayout },
      ...Object.fromEntries(EVENT_SCREENS.map((name) => [`(tabs)/events/${name}`, page(name)])),
    },
    { initialUrl: "/" },
  );
  renderedApp = app;
  // renderRouter turns on fake timers, under which the frame between two navigates never comes. keep-comment: hidden test-kit behaviour
  jest.useRealTimers();
  await act(async () => {
    finishStartup();
  });
  await act(async () => {});
  return app;
}

let renderedApp: RenderRouterResult | undefined;

function pushTo(type: PushType, eventIdentifier: string) {
  const app = renderedApp;
  if (!app) throw new Error("expected the app to be rendered");
  return openPushRoute(
    NOTIFICATION_HANDLERS[type],
    { type, eventIdentifier },
    { currentPath: () => app.getPathname(), rootState: () => app.getRouterState() },
  );
}

// React schedules as in the app here: act would hold back the render a tab mounts in until after the frame wait. keep-comment: inside act the frame wait proves nothing
async function tap(type: PushType, eventIdentifier: string) {
  const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  await pushTo(type, eventIdentifier);
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {});
}

type NavigationLevel = {
  index?: number;
  routes: { name: string; state?: NavigationLevel; params?: { identifier?: string } }[];
};

function focusedTabStack(app: RenderRouterResult): string[] {
  let level = app.getRouterState() as unknown as NavigationLevel | undefined;
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

    await tap(type, "ev1");

    expect(app.getPathname()).toBe(path);
    expect(focusedTabStack(app)).toEqual(stack);
    await act(() => router.back());
    expect(app.getPathname()).toBe(backTo);
  });

  it("opens over the tab's first screen on a cold start", async () => {
    let opened: Promise<void> | undefined;
    const app = await renderApp(() => {
      opened = pushTo(type, "ev1");
    });
    await act(async () => {
      await opened;
    });

    expect(app.getPathname()).toBe(path);
    expect(focusedTabStack(app)).toEqual(stack);
  });
});

it("walks back from a tapped board post through the event and the list, then out of the tab", async () => {
  const app = await renderApp();

  await tap("event_post", "ev1");
  await act(() => router.back());
  expect(app.getPathname()).toBe("/events/event/ev1");
  await act(() => router.back());
  expect(app.getPathname()).toBe("/events");
  await act(() => router.back());
  expect(app.getPathname()).toBe("/");
});

it("adds nothing when the tapped board is already open", async () => {
  const app = await renderApp();
  await tap("event_post", "ev1");

  await tap("event_post", "ev1");

  expect(focusedTabStack(app)).toEqual(BOARD_STACK);
});

it("adds only the board when the post's event is already open", async () => {
  const app = await renderApp();
  await tap("event_invite", "ev1");

  await tap("event_post", "ev1");

  expect(focusedTabStack(app)).toEqual(BOARD_STACK);
});

it("keeps the board the user was reading beneath a post for another event", async () => {
  const app = await renderApp();
  await tap("event_post", "A");

  await tap("event_post", "B");

  expect(app.getPathname()).toBe("/events/board/B");
  await act(() => router.back());
  expect(app.getPathname()).toBe("/events/event/B");
  await act(() => router.back());
  expect(app.getPathname()).toBe("/events/board/A");
});

it("keeps an open event beneath a tap for another event", async () => {
  const app = await renderApp();
  await tap("event_invite", "A");

  await tap("event_invite", "B");

  expect(app.getPathname()).toBe("/events/event/B");
  await act(() => router.back());
  expect(app.getPathname()).toBe("/events/event/A");
});

it("opens over the list when the events tab was visited earlier", async () => {
  const app = await renderApp();
  await act(() => router.navigate("/(tabs)/events"));
  await act(() => router.navigate("/(tabs)/(home)"));

  await tap("event_updated", "ev1");

  expect(focusedTabStack(app)).toEqual(EVENT_DETAIL_STACK);
});
