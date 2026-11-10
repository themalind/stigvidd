// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import SettingsDrawer from "@/components/settings/drawer";
import "@/i18n";
import { router, Stack } from "expo-router";
import { act, fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { useState } from "react";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TabsLayout from "../_layout";
import SettingsLayout from "../(settings)/_layout";

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: false, logout: jest.fn() }),
}));

jest.mock("@/components/layout/header", () => ({ __esModule: true, default: () => null }));

jest.mock("@/atoms/friends-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { pendingNotificationsCountAtom: atom(0) };
});

jest.mock("@/atoms/event-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { pendingEventInvitationsCountAtom: atom(0) };
});

const METRICS = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const VISIBLE_TABS = 5;
const SETTINGS_SCREENS = ["theme", "privacy", "about"];

function page(label: string) {
  return function Page() {
    return <Text>{label}</Text>;
  };
}

function plainStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function StartWithOpenDrawer() {
  const [open, setOpen] = useState(true);
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <Text>start</Text>
      <SettingsDrawer visible={open} onDismiss={() => setOpen(false)} />
    </SafeAreaProvider>
  );
}

async function renderTabs() {
  const app = await renderRouter(
    {
      "(tabs)/_layout": TabsLayout,
      "(tabs)/(home)/_layout": plainStack,
      "(tabs)/(home)/index": StartWithOpenDrawer,
      "(tabs)/(map)/_layout": plainStack,
      "(tabs)/(map)/map": page("map"),
      "(tabs)/trails/_layout": plainStack,
      "(tabs)/trails/index": page("trails"),
      "(tabs)/events/_layout": plainStack,
      "(tabs)/events/index": page("events"),
      "(tabs)/(profile-stack)/_layout": plainStack,
      "(tabs)/(profile-stack)/login": page("login"),
      "(tabs)/(settings)/_layout": SettingsLayout,
      ...Object.fromEntries(SETTINGS_SCREENS.map((name) => [`(tabs)/(settings)/${name}`, page(name)])),
    },
    { initialUrl: "/" },
  );
  await act(async () => {});
  return app;
}

async function pressRow(label: string) {
  await fireEvent.press(screen.getByText(label));
  await act(async () => {});
}

const ROWS: [string, string][] = [
  ["Tema", "theme"],
  ["Integritet", "privacy"],
  ["Om Stigvidd", "about"],
  ["Logga in", "login"],
];

describe.each(ROWS)("the drawer's %s row", (label, screenName) => {
  it("opens its screen and keeps the five tabs on the bar", async () => {
    const app = await renderTabs();

    await pressRow(label);

    expect(app.getPathname()).toBe(`/${screenName}`);
    expect(screen.getByText(screenName)).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(VISIBLE_TABS);
  });

  // With no history, Android's back button would close the app from here.
  it("goes back to the start tab", async () => {
    const app = await renderTabs();
    await pressRow(label);

    expect(router.canGoBack()).toBe(true);
    await act(async () => {
      router.back();
    });

    expect(app.getPathname()).toBe("/");
  });
});

it("forgets an earlier visit, so back from the next screen goes to the start tab", async () => {
  const app = await renderTabs();
  await pressRow("Om Stigvidd");
  await act(async () => {
    router.back();
  });

  await act(async () => {
    router.navigate("/(tabs)/(settings)/privacy");
  });
  expect(app.getPathname()).toBe("/privacy");
  await act(async () => {
    router.back();
  });

  expect(app.getPathname()).toBe("/");
});
