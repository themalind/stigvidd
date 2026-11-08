// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { getActionFromState } from "expo-router/react-navigation";
import { Stack, Tabs, router } from "expo-router";
import { store } from "expo-router/build/global-state/router-store";
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

async function renderApp(initialUrl: string) {
  const app = renderRouter(
    {
      _layout: GatedRoot,
      "+native-intent": nativeIntent,
      "(tabs)/_layout": () => <Tabs />,
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

// What the linking listener does with a link that arrives while the app runs (expo-router's fork/useLinking.native.js). keep-comment: the test kit stubs the url event out
async function openLinkWhileRunning(url: string) {
  const linking = store.linking;
  if (!linking) throw new Error("expected linking");
  const path = nativeIntent.redirectSystemPath({ path: url, initial: false });
  const state = linking.getStateFromPath(path, linking.config);
  if (!state) throw new Error("expected a state for " + path);
  const action = getActionFromState(state as never, linking.config as never);
  if (!action) throw new Error("expected an action for " + path);
  await act(async () => {
    store.navigationRef.dispatch(action);
  });
}

it("puts the event list beneath an event a shared link opens the app on", async () => {
  const app = await renderApp(linkTo("ev1"));
  expect(app.getPathname()).toBe("/events/event/ev1");
  expect(screen.getByText("event")).toBeTruthy();

  act(() => router.back());
  expect(app.getPathname()).toBe("/events");
  expect(screen.getByText("event list")).toBeTruthy();
});

it("puts the event list beneath an event a shared link opens while the app is running", async () => {
  const app = await renderApp("/");

  await openLinkWhileRunning(linkTo("ev1"));
  expect(app.getPathname()).toBe("/events/event/ev1");

  act(() => router.back());
  expect(app.getPathname()).toBe("/events");
});

it("leaves the tab usable after a link", async () => {
  const app = await renderApp(linkTo("ev1"));

  act(() => router.navigate("/(tabs)/events/create"));
  expect(app.getPathname()).toBe("/events/create");
  act(() => router.back());
  expect(app.getPathname()).toBe("/events/event/ev1");
});
