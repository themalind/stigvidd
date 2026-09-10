// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { userThemeAtom } from "@/atoms/user-theme-atom";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { focusManager, QueryClient } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react-native";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import { getDefaultStore } from "jotai";
import { queryClientAtom } from "jotai-tanstack-query";
import { AppState, AppStateStatus, Platform } from "react-native";
import RootLayout from "../_layout";

const mockInitAuth = jest.fn();
const mockRegisterPush = jest.fn();
const mockLoadUserTheme = jest.fn();
const mockLoadStoredLanguage = jest.fn();
const mockPruneTrailCardCache = jest.fn();
const mockInitMapTiler = jest.fn();
const mockInitMapCache = jest.fn();
const mockLogError = jest.fn();
const mockRemoveListener = jest.fn();
const mockRemoveAppStateListener = jest.fn();
const mockPush = jest.fn();

// Read inside the hooks, so a test can sign in or take the fonts away before the render.
let mockAuth: { user: { id: string } | null; isLoading: boolean };
let mockFontsLoaded: boolean;
// The notification the app was opened by, and the listener for ones arriving while it is open.
let mockLastResponse: unknown;
let mockReceived: ((notification: unknown) => void) | undefined;
// The app-state handler the query cache follows the foreground with.
let appStateChanged: ((status: AppStateStatus) => void) | undefined;

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => mockAuth,
  useInitAuth: () => mockInitAuth(),
}));

jest.mock("@expo-google-fonts/inter", () => ({
  Inter_600SemiBold: "Inter_600SemiBold",
  useFonts: () => [mockFontsLoaded],
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: () => mockLastResponse,
  addNotificationReceivedListener: (callback: (notification: unknown) => void) => {
    mockReceived = callback;
    return { remove: mockRemoveListener };
  },
  AndroidImportance: { MAX: 5 },
}));

// The route and query-key maps stay real; only the registration, which talks to Expo's push service, is replaced.
jest.mock("@/services/notifications", () => ({
  ...jest.requireActual("@/services/notifications"),
  registerForPushNotificationsAsync: () => mockRegisterPush(),
}));

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  const router = { push: (...args: unknown[]) => mockPush(...args) };
  const Stack = ({ children }: { children: React.ReactNode }) =>
    React.createElement(View, { testID: "root-stack" }, children);
  Stack.Screen = function StackScreen() {
    return null;
  };
  return { Stack, useRouter: () => router };
});

jest.mock("expo-navigation-bar", () => ({ setButtonStyleAsync: jest.fn() }));

// GestureHandlerRootView needs a native module that Jest has none of; a plain View is the same box.
jest.mock("react-native-gesture-handler", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  return { GestureHandlerRootView: View };
});

// initTelemetry() runs when this file imports the layout, before any test body could spy on it.
jest.mock("@/services/telemetry", () => {
  let calls = 0;
  return { initTelemetry: () => (calls += 1), telemetryCalls: () => calls };
});

jest.mock("@/services/logger", () => ({
  logger: { error: (...args: unknown[]) => mockLogError(...args), info: jest.fn(), debug: jest.fn() },
}));

// Registers a background task with TaskManager at import; nothing here needs it.
jest.mock("@/services/location-task", () => ({}));

jest.mock("@/atoms/user-theme-atom", () => ({
  ...jest.requireActual("@/atoms/user-theme-atom"),
  loadUserTheme: () => mockLoadUserTheme(),
}));

// The real i18n instance still has to initialise — every string on screen comes from it.
jest.mock("@/i18n", () => ({
  ...jest.requireActual("@/i18n"),
  loadStoredLanguage: () => mockLoadStoredLanguage(),
}));

jest.mock("@/hooks/useTrailCard", () => ({ pruneTrailCardCache: () => mockPruneTrailCardCache() }));
jest.mock("@/components/map/map-style", () => ({ initMapTiler: () => mockInitMapTiler() }));
jest.mock("@/utils/map-cache", () => ({ initMapCache: () => mockInitMapCache() }));
const { telemetryCalls } = jest.requireMock("@/services/telemetry");

const USER = { id: "user-1" };
const store = getDefaultStore();

function tap(type: string | undefined, identifier = "notif-1") {
  mockLastResponse = { notification: { request: { identifier, content: { data: type ? { type } : {} } } } };
}

// The layout mounts the app's providers itself, so it is rendered bare. The flush is part of
// mounting: the startup effects resolve a tick later, and a late promise sets an atom outside act().
async function show() {
  const rendered = render(<RootLayout />);
  await settle();
  return rendered;
}

// A theme change re-renders the layout without remounting it.
async function rerender(theme: "light" | "dark" = "dark") {
  await act(async () => {
    store.set(userThemeAtom, theme);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = { user: null, isLoading: false };
  mockFontsLoaded = true;
  mockLastResponse = null;
  mockReceived = undefined;
  mockLoadUserTheme.mockResolvedValue("auto");
  mockRegisterPush.mockResolvedValue(undefined);
  store.set(userThemeAtom, "auto");
  store.set(snackbarAtom, { visible: false, message: "", type: "success" });
  jest.spyOn(QueryClient.prototype, "invalidateQueries").mockReturnValue(Promise.resolve());
  appStateChanged = undefined;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    type: string,
    handler: (status: AppStateStatus) => void,
  ) => {
    if (type === "change") appStateChanged = handler;
    return { remove: mockRemoveAppStateListener };
  }) as never);
});

afterEach(() => {
  jest.restoreAllMocks();
  Platform.OS = "ios";
  focusManager.setFocused(undefined);
});

// Nothing is drawn until the stored session is restored, so the signed-out app never flashes.
it("draws nothing until the stored session has resolved", async () => {
  mockAuth = { user: null, isLoading: true };
  await show();

  expect(screen.toJSON()).toBeNull();
});

// Nothing is drawn until the heading font lands, so headings never reflow out of the system font.
it("draws nothing until the app's own font has loaded", async () => {
  mockFontsLoaded = false;
  await show();

  expect(screen.toJSON()).toBeNull();
});

it("shows the navigator once the session and the font are both in", async () => {
  await show();

  expect(screen.getByTestId("root-stack")).toBeTruthy();
  expect(screen.getByTestId("root-container")).toBeTruthy();
});

// The restore starts outside the gate above, which would otherwise wait for something never begun.
it("starts restoring the session even while it is drawing nothing", async () => {
  mockAuth = { user: null, isLoading: true };
  await show();

  expect(screen.toJSON()).toBeNull();
  expect(mockInitAuth).toHaveBeenCalled();
});

// Telemetry is set up at bundle evaluation, so a crash before the gate opens is still reported.
it("starts telemetry once for the whole app, not once per render", async () => {
  expect(telemetryCalls()).toBe(1);

  await show();
  await rerender();
  screen.unmount();
  await show();

  expect(telemetryCalls()).toBe(1);
});

it("dresses the app in the light theme", async () => {
  await show();

  expect(screen.getByTestId("root-container")).toHaveStyle({
    flex: 1,
    backgroundColor: AppDefaultTheme.colors.background,
  });
  expect(screen.UNSAFE_getByType(StatusBar).props.style).toBe("dark");
});

// A dark status bar over a dark app is invisible, so the two have to move together.
it("dresses the app in the dark theme, status bar and all", async () => {
  await show();
  await rerender("dark");

  expect(screen.getByTestId("root-container")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.background });
  expect(screen.UNSAFE_getByType(StatusBar).props.style).toBe("light");
});

// Android's navigation bar is the one part of the chrome the theme cannot reach through React.
it("tells Android's navigation bar which theme it is on", async () => {
  Platform.OS = "android";
  await show();
  await rerender("dark");

  expect(NavigationBar.setButtonStyleAsync).toHaveBeenCalledWith("light");
});

it("leaves the navigation bar alone on iOS, which has none", async () => {
  await show();
  await rerender("dark");

  expect(NavigationBar.setButtonStyleAsync).not.toHaveBeenCalled();
});

// The choice is stored on the device, so the app has to come back up in it.
it("restores the stored theme at startup", async () => {
  mockLoadUserTheme.mockResolvedValue("dark");
  await show();
  await settle();

  expect(store.get(userThemeAtom)).toBe("dark");
  expect(screen.getByTestId("root-container")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.background });
});

// The jotai query atoms build a client of their own unless they are handed this one.
it("hands the app's query client to the atoms", async () => {
  // It has to be the client the provider mounted the tree on, not just any QueryClient.
  const mounted: QueryClient[] = [];
  jest.spyOn(QueryClient.prototype, "mount").mockImplementation(function (this: QueryClient) {
    mounted.push(this);
  });

  await show();
  await settle();

  expect(mounted).toHaveLength(1);
  expect(store.get(queryClientAtom)).toBe(mounted[0]);
});

// A new client per render would empty the cache under every screen that reads it.
it("keeps one query client for the app's lifetime", async () => {
  await show();
  await settle();
  const first = store.get(queryClientAtom);

  await rerender();

  expect(store.get(queryClientAtom)).toBe(first);
});

it("prepares the language, the map style and the tile cache at startup", async () => {
  await show();
  await settle();

  expect(mockLoadStoredLanguage).toHaveBeenCalledTimes(1);
  expect(mockPruneTrailCardCache).toHaveBeenCalledTimes(1);
  expect(mockInitMapTiler).toHaveBeenCalledTimes(1);
  expect(mockInitMapCache).toHaveBeenCalledTimes(1);
});

// Re-running these on every render would re-open the tile database mid-session.
it("prepares them once, however often the app re-renders", async () => {
  await show();
  await settle();
  await rerender();
  await rerender("light");

  expect(mockInitMapCache).toHaveBeenCalledTimes(1);
  expect(mockPruneTrailCardCache).toHaveBeenCalledTimes(1);
});

// A push token belongs to an account, so registration waits for sign-in.
it("waits for a signed-in user before it registers for push", async () => {
  await show();
  await settle();

  expect(mockRegisterPush).not.toHaveBeenCalled();

  mockAuth = { user: USER, isLoading: false };
  await rerender();

  expect(mockRegisterPush).toHaveBeenCalledTimes(1);
});

// A device that will not give a token must not take the app down at startup.
it("logs a failed push registration rather than crashing on it", async () => {
  mockRegisterPush.mockRejectedValue(new Error("no token"));
  mockAuth = { user: USER, isLoading: false };
  await show();
  await settle();

  expect(mockLogError).toHaveBeenCalledWith(
    "Push notification registration failed",
    expect.objectContaining({ errorMessage: expect.stringContaining("no token") }),
  );
});

// A notification arriving while the app is open refreshes the list it is about, and moves no one.
it("refreshes the lists a notification arriving in the foreground is about", async () => {
  await show();
  await settle();

  act(() => mockReceived?.({ request: { content: { data: { type: "friend_request" } } } }));

  expect(QueryClient.prototype.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["friends", "incoming"] });
  expect(mockPush).not.toHaveBeenCalled();
});

it("ignores a foreground notification of a type it knows nothing about", async () => {
  await show();
  await settle();

  act(() => mockReceived?.({ request: { content: { data: { type: "kaffepaus" } } } }));
  act(() => mockReceived?.({ request: { content: {} } }));

  expect(QueryClient.prototype.invalidateQueries).not.toHaveBeenCalled();
});

// The listener outlives the component otherwise, and a second mount would refresh twice.
it("stops listening when the app's root goes away", async () => {
  await show();
  await settle();

  screen.unmount();

  expect(mockRemoveListener).toHaveBeenCalled();
});

it("opens the screen a tapped notification points at, and refreshes it", async () => {
  tap("hike_share");
  mockAuth = { user: USER, isLoading: false };
  await show();
  await settle();

  expect(mockPush).toHaveBeenCalledWith("/(tabs)/(profile-stack)/user/shared-hikes");
  expect(QueryClient.prototype.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["shared-hikes"] });
});

// A cold start waits for the session before navigating, or it lands on a screen with no account.
it("holds a tap until the session is back", async () => {
  tap("friend_request");
  await show();
  await settle();

  expect(mockPush).not.toHaveBeenCalled();

  mockAuth = { user: USER, isLoading: false };
  await rerender();

  expect(mockPush).toHaveBeenCalledWith("/(tabs)/(profile-stack)/user/friends");
});

// The OS keeps reporting the same tap after a restart, so it is only acted on once.
it("acts on the same tap only once", async () => {
  tap("friend_request");
  mockAuth = { user: USER, isLoading: false };
  await show();
  await settle();

  expect(mockPush).toHaveBeenCalledTimes(1);

  // A token refresh hands out a new user object, which is what the effect watches.
  mockAuth = { user: { ...USER }, isLoading: false };
  await rerender();
  await rerender("light");

  expect(mockPush).toHaveBeenCalledTimes(1);
});

it("stays put for a tap that carries no type, and for one it cannot place", async () => {
  tap(undefined);
  mockAuth = { user: USER, isLoading: false };
  await show();
  await settle();

  expect(mockPush).not.toHaveBeenCalled();

  tap("kaffepaus", "notif-2");
  await rerender();

  expect(mockPush).not.toHaveBeenCalled();
  expect(QueryClient.prototype.invalidateQueries).not.toHaveBeenCalled();
});

// The tabs carry their own headers, so the stack draws none above them.
it("gives the tab navigator no header of its own", async () => {
  await show();

  expect(screen.UNSAFE_getByProps({ name: "(tabs)" }).props.options).toEqual({ headerShown: false });
});

// Every screen raises the snackbar through an atom, so it is mounted once at the root, above the navigator.
it("carries the snackbar above the whole app", async () => {
  await show();
  await settle();

  await act(async () => {
    store.set(snackbarAtom, { visible: true, message: "Sparat", type: "success" });
  });

  expect(screen.getByText("Sparat")).toBeTruthy();
});

// React Query refetches on window focus, and a phone has no window: the return from background says so.
it("follows the app in and out of the foreground with the query cache", async () => {
  await show();

  act(() => appStateChanged?.("background"));
  expect(focusManager.isFocused()).toBe(false);

  act(() => appStateChanged?.("active"));
  expect(focusManager.isFocused()).toBe(true);
});
