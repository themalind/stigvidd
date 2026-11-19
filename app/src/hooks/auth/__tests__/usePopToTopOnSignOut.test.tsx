// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import * as auth from "@/components/auth/auth-provider";
import { usePopToTopOnSignOut } from "@/hooks/auth/usePopToTopOnSignOut";
import { Stack, Tabs, router } from "expo-router";
import { act, renderRouter, screen, type RenderRouterResult } from "expo-router/testing-library";
import { useSyncExternalStore } from "react";
import { Text } from "react-native";

let signedIn = true;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useFakeAuth() {
  const isAuthenticated = useSyncExternalStore(subscribe, () => signedIn);
  return { isAuthenticated } as ReturnType<typeof auth.useAuth>;
}

function setSignedIn(value: boolean) {
  signedIn = value;
  listeners.forEach((listener) => listener());
}

type NavState = { routes: { name: string; state?: NavState }[] };

// The screens in the events tab's stack, whether or not that tab is shown. keep-comment: the pathname only shows the focused tab
function eventsStack(app: RenderRouterResult): string[] {
  const find = (state: NavState | undefined): NavState | undefined => {
    for (const route of state?.routes ?? []) {
      if (route.name === "events") return route.state;
      const found = find(route.state);
      if (found) return found;
    }
    return undefined;
  };
  return find(app.getRouterState() as NavState | undefined)?.routes.map((route) => route.name) ?? [];
}

function GuardedPage() {
  usePopToTopOnSignOut();
  return <Text>board</Text>;
}

async function renderApp(initialUrl: string) {
  const app = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false }} />,
      "(tabs)/_layout": () => (
        <Tabs>
          <Tabs.Screen name="(home)" />
          <Tabs.Screen name="events" />
        </Tabs>
      ),
      "(tabs)/(home)/_layout": () => <Stack />,
      "(tabs)/(home)/index": () => <Text>Start</Text>,
      "(tabs)/events/_layout": {
        unstable_settings: { anchor: "index" },
        default: () => <Stack />,
      },
      "(tabs)/events/index": () => <Text>event list</Text>,
      "(tabs)/events/board/[identifier]": GuardedPage,
    },
    { initialUrl },
  );
  await act(async () => {});
  return app;
}

beforeEach(() => {
  signedIn = true;
  listeners.clear();
  jest.spyOn(auth, "useAuth").mockImplementation(useFakeAuth);
});

it("returns to the list when the user signs out on the screen", async () => {
  const app = await renderApp("/events/board/ev1");

  await act(async () => setSignedIn(false));
  expect(app.getPathname()).toBe("/events");
  expect(screen.getByText("event list")).toBeTruthy();
});

it("returns the events tab to its list when the user signs out from another tab, without switching tab", async () => {
  const app = await renderApp("/events/board/ev1");
  await act(() => router.navigate("/(tabs)/(home)"));
  expect(eventsStack(app)).toEqual(["index", "board/[identifier]"]);

  await act(async () => setSignedIn(false));
  expect(app.getPathname()).toBe("/");
  expect(eventsStack(app)).toEqual(["index"]);
});

it("leaves the screen open for a user who was never signed in", async () => {
  signedIn = false;
  const app = await renderApp("/events/board/ev1");

  await act(async () => setSignedIn(false));
  expect(app.getPathname()).toBe("/events/board/ev1");
});
