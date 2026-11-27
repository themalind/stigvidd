// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import * as HomeStackLayout from "@/app/(tabs)/(home)/_layout";
import * as MapLayout from "@/app/(tabs)/(map)/_layout";
import * as ProfileStackLayout from "@/app/(tabs)/(profile-stack)/_layout";
import * as SettingsLayout from "@/app/(tabs)/(settings)/_layout";
import * as EventsStackLayout from "@/app/(tabs)/events/_layout";
import * as TrailsStackLayout from "@/app/(tabs)/trails/_layout";
import RouteErrorBoundary from "@/components/status/route-error-boundary";
import "@/i18n";
import sv from "@/i18n/locales/sv.json";
import { fireEvent } from "@testing-library/react-native";
import { Tabs, router } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: false, logout: jest.fn() }),
}));
jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

let mockCrashes = true;

function CrashingTrails() {
  if (mockCrashes) throw new TypeError("Cannot read property 'name' of undefined");
  return <Text>Lederna</Text>;
}

function Start() {
  return <Text>Start</Text>;
}

function renderApp() {
  return renderRouter(
    {
      "(tabs)/_layout": () => (
        <Tabs>
          <Tabs.Screen name="(home)/index" />
          <Tabs.Screen name="trails" />
        </Tabs>
      ),
      "(tabs)/(home)/index": Start,
      "(tabs)/trails/_layout": TrailsStackLayout,
      "(tabs)/trails/index": CrashingTrails,
    },
    { initialUrl: "/trails" },
  );
}

beforeEach(() => {
  mockCrashes = true;
  // keep-comment: React reports every caught render error on console.error
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.mocked(console.error).mockRestore();
});

it.each([
  ["(home)", HomeStackLayout],
  ["(map)", MapLayout],
  ["(profile-stack)", ProfileStackLayout],
  ["(settings)", SettingsLayout],
  ["events", EventsStackLayout],
  ["trails", TrailsStackLayout],
])("the %s stack catches its screens' crashes", (_, layout) => {
  expect(layout.ErrorBoundary).toBe(RouteErrorBoundary);
});

it("shows the error view in place of a screen that threw while rendering", async () => {
  await renderApp();

  expect(screen.getByText(sv.error.default.title)).toBeTruthy();
  expect(screen.queryByText("Lederna")).toBeNull();
});

it("renders the screen again on retry", async () => {
  await renderApp();

  mockCrashes = false;
  await act(() => fireEvent.press(screen.getByText(sv.error.retry)));

  expect(screen.getByText("Lederna")).toBeTruthy();
});

function renderLinkedTrail() {
  return renderRouter(
    {
      "(tabs)/_layout": () => (
        <Tabs>
          <Tabs.Screen name="trails" />
        </Tabs>
      ),
      "(tabs)/trails/_layout": TrailsStackLayout,
      "(tabs)/trails/index": () => <Text>Lederna</Text>,
      "(tabs)/trails/trail/[identifier]": CrashingTrails,
    },
    { initialUrl: "/trails/trail/42" },
  );
}

it("keeps a linked screen that always crashes on retry, which is why it needs a way out", async () => {
  await renderLinkedTrail();

  await act(() => fireEvent.press(screen.getByText(sv.error.retry)));

  expect(screen.getByText(sv.error.default.title)).toBeTruthy();
});

it("takes the reader back to the start of the tab from a linked screen that keeps crashing", async () => {
  const app = await renderLinkedTrail();

  await act(() => fireEvent.press(screen.getByText(sv.error.backToStart)));

  expect(app.getPathname()).toBe("/trails");
  expect(screen.getByText("Lederna")).toBeTruthy();
});

it("offers no way back from the first screen of a tab, which has nothing beneath it", async () => {
  await renderApp();

  expect(screen.queryByText(sv.error.backToStart)).toBeNull();
});

it("leaves the other tabs reachable", async () => {
  const app = await renderApp();

  await act(() => router.navigate("/"));

  expect(app.getPathname()).toBe("/");
  expect(screen.getByText("Start")).toBeTruthy();
});
