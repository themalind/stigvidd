// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Stack, Tabs, router } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import TrailsStackLayout, * as layout from "../_layout";
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
          <Tabs.Screen name="(map)" />
          <Tabs.Screen name="trails" />
        </Tabs>
      ),
      "(tabs)/(home)/_layout": () => <Stack />,
      "(tabs)/(home)/index": page("Start"),
      "(tabs)/(map)/_layout": () => <Stack />,
      "(tabs)/(map)/index": page("Map"),
      "(tabs)/trails/_layout": { ...layout, default: TrailsStackLayout },
      "(tabs)/trails/index": page("trail list"),
      "(tabs)/trails/trail/[identifier]": page("trail"),
      "(tabs)/trails/follow/[identifier]": page("follow"),
      "(tabs)/trails/guide": page("guide"),
    },
    { initialUrl },
  );
  await act(async () => {});
  return app;
}

function linkTo(identifier: string) {
  return `https://link.stigvidd.se/trail/${identifier}`;
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

it("starts on the start page", async () => {
  const app = await renderApp("/");

  expect(app.getPathname()).toBe("/");
  expect(screen.getByText("Start")).toBeTruthy();
});

it("puts the trail list beneath a trail a shared link opens the app on", async () => {
  const app = await renderApp(linkTo("abc123"));
  expect(app.getPathname()).toBe("/trails/trail/abc123");

  await act(() => router.back());
  expect(app.getPathname()).toBe("/trails");
  expect(screen.getByText("trail list")).toBeTruthy();
});

it("puts the trail list beneath a trail a shared link opens while the app is running", async () => {
  const app = await renderApp("/");

  await openLinkWhileRunning(linkTo("abc123"));
  expect(app.getPathname()).toBe("/trails/trail/abc123");

  await act(() => router.back());
  expect(app.getPathname()).toBe("/trails");
});

it("goes back from a second shared link to the list", async () => {
  const app = await renderApp(linkTo("first"));

  await openLinkWhileRunning(linkTo("second"));
  expect(app.getPathname()).toBe("/trails/trail/second");

  await act(() => router.back());
  expect(app.getPathname()).toBe("/trails");
});

it("goes back from a shared link to the list, past a trail opened from the list", async () => {
  const app = await renderApp("/");
  await act(() => router.navigate("/(tabs)/trails"));
  await act(() => router.push("/trails/trail/browsed"));
  expect(app.getPathname()).toBe("/trails/trail/browsed");

  await openLinkWhileRunning(linkTo("shared"));
  expect(app.getPathname()).toBe("/trails/trail/shared");

  await act(() => router.back());
  expect(app.getPathname()).toBe("/trails");
});

it("goes back from a shared link to the list, past a trail left open in the tab earlier", async () => {
  const app = await renderApp("/");
  await act(() => router.navigate("/(tabs)/trails"));
  await act(() => router.push("/trails/trail/browsed"));
  await act(() => router.navigate("/(tabs)/(home)"));
  expect(app.getPathname()).toBe("/");

  await openLinkWhileRunning(linkTo("shared"));
  expect(app.getPathname()).toBe("/trails/trail/shared");

  await act(() => router.back());
  expect(app.getPathname()).toBe("/trails");
});

it("opens the trail list from another tab", async () => {
  const app = await renderApp("/");

  await act(() => router.navigate("/(tabs)/trails"));
  expect(app.getPathname()).toBe("/trails");
  expect(screen.getByText("trail list")).toBeTruthy();
});
