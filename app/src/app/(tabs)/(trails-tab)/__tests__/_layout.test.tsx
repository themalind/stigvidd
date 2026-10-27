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
import { useOpenLinkedTrail } from "@/hooks/trail/useOpenLinkedTrail";
import TrailsStackLayout, * as layout from "../_layout";
import { redirectSystemPath } from "../../../+native-intent";

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

function TrailList() {
  useOpenLinkedTrail();
  return <Text>trail list</Text>;
}

async function renderApp(initialUrl: string) {
  const app = renderRouter(
    {
      _layout: GatedRoot,
      "(tabs)/_layout": () => <Tabs />,
      "(tabs)/(home)/_layout": () => <Stack />,
      "(tabs)/(home)/index": page("Start"),
      "(tabs)/(map)/_layout": () => <Stack />,
      "(tabs)/(map)/index": page("Map"),
      "(tabs)/(trails-tab)/_layout": { ...layout, default: TrailsStackLayout },
      "(tabs)/(trails-tab)/index": TrailList,
      "(tabs)/(trails-tab)/trail/[identifier]": page("trail"),
      "(tabs)/(trails-tab)/follow/[identifier]": page("follow"),
      "(tabs)/(trails-tab)/guide": page("guide"),
    },
    { initialUrl },
  );
  await act(async () => {});
  return app;
}

function linkTo(identifier: string) {
  return redirectSystemPath({ path: `https://link.stigvidd.se/trail/${identifier}`, initial: true });
}

it("starts on the start page, though three tabs have an index screen", async () => {
  const app = await renderApp("/");

  expect(app.getPathname()).toBe("/");
  expect(screen.getByText("Start")).toBeTruthy();
});

it("puts the trail list beneath a trail a shared link opens the app on", async () => {
  const app = await renderApp(linkTo("abc123"));
  expect(app.getPathname()).toBe("/trail/abc123");

  act(() => router.back());
  expect(screen.getByText("trail list")).toBeTruthy();
});

it("puts the trail list beneath a trail a shared link opens while the app is running", async () => {
  const app = await renderApp("/");

  act(() => router.navigate(linkTo("abc123") as never));
  expect(app.getPathname()).toBe("/trail/abc123");

  act(() => router.back());
  expect(screen.getByText("trail list")).toBeTruthy();
});

it("opens a second shared link over the list, not over the first trail", async () => {
  const app = await renderApp(linkTo("first"));

  act(() => router.navigate(linkTo("second") as never));
  expect(app.getPathname()).toBe("/trail/second");

  act(() => router.back());
  expect(screen.getByText("trail list")).toBeTruthy();
});

it("does not open the trail again when the user goes back to the list", async () => {
  const app = await renderApp(linkTo("abc123"));

  act(() => router.back());
  await act(async () => {});

  expect(app.getPathname()).toBe("/");
  expect(screen.getByText("trail list")).toBeTruthy();
});
