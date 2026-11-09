// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Stack, Tabs, router } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import EventsStackLayout, * as layout from "../_layout";
import * as nativeIntent from "../../../+native-intent";

function page(label: string) {
  return function Page() {
    return <Text>{label}</Text>;
  };
}

// Like the app's root layout, it draws nothing until its startup work is done. keep-comment: a link acted on in the first effect is lost behind this gate
function GatedRoot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => setReady(true));
  }, []);
  if (!ready) return null;
  return <Stack screenOptions={{ headerShown: false }} />;
}

let urlListener: ((url: string) => void) | undefined;

async function renderApp(initialUrl: string) {
  const app = await renderRouter(
    {
      _layout: GatedRoot,
      "+native-intent": {
        ...nativeIntent,
        legacy_subscribe: (listener: (url: string) => void) => {
          urlListener = listener;
          return () => {};
        },
      },
      "(tabs)/_layout": () => (
        <Tabs>
          <Tabs.Screen name="(home)" />
          <Tabs.Screen name="(profile-stack)" />
          <Tabs.Screen name="events" />
        </Tabs>
      ),
      "(tabs)/(home)/_layout": () => <Stack />,
      "(tabs)/(home)/index": page("Start"),
      "(tabs)/(profile-stack)/_layout": () => <Stack />,
      "(tabs)/(profile-stack)/event/[identifier]": page("profile event"),
      "(tabs)/events/_layout": { ...layout, default: EventsStackLayout },
      "(tabs)/events/index": page("event list"),
      "(tabs)/events/event/[identifier]": page("event"),
      "(tabs)/events/board/[identifier]": page("board"),
      "(tabs)/events/create": page("create"),
    },
    { initialUrl },
  );
  await act(async () => {});
  return app;
}

function linkTo(identifier: string) {
  return `https://link.stigvidd.se/event/${identifier}`;
}

// Hands a link to expo-router's own listener, as the url event would. keep-comment: the test kit stubs the url event out
async function openLinkWhileRunning(url: string) {
  const listener = urlListener;
  if (!listener) throw new Error("expected the router to listen for links");
  await act(async () => {
    const path = nativeIntent.redirectSystemPath({ path: url, initial: false });
    if (path) listener(path);
  });
}

it("puts the event list beneath an event a shared link opens the app on", async () => {
  const app = await renderApp(linkTo("ev1"));
  expect(app.getPathname()).toBe("/events/event/ev1");
  expect(screen.getByText("event")).toBeTruthy();

  await act(() => router.back());
  expect(app.getPathname()).toBe("/events");
  expect(screen.getByText("event list")).toBeTruthy();
});

it("puts the event list beneath an event a shared link opens while the app is running", async () => {
  const app = await renderApp("/");

  await openLinkWhileRunning(linkTo("ev1"));
  expect(app.getPathname()).toBe("/events/event/ev1");

  await act(() => router.back());
  expect(app.getPathname()).toBe("/events");
});

it("goes back from a shared link to the list, past an event left open in the tab earlier", async () => {
  const app = await renderApp("/");
  await act(() => router.navigate("/(tabs)/events"));
  await act(() => router.push("/events/event/browsed"));
  await act(() => router.navigate("/(tabs)/(home)"));
  expect(app.getPathname()).toBe("/");

  await openLinkWhileRunning(linkTo("shared"));
  expect(app.getPathname()).toBe("/events/event/shared");

  await act(() => router.back());
  expect(app.getPathname()).toBe("/events");
});

it("leaves the tab usable after a link", async () => {
  const app = await renderApp(linkTo("ev1"));

  await act(() => router.navigate("/(tabs)/events/create"));
  expect(app.getPathname()).toBe("/events/create");
  await act(() => router.back());
  expect(app.getPathname()).toBe("/events/event/ev1");
});
