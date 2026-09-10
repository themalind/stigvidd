// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import SettingsDrawer from "@/components/settings/drawer";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen } from "@testing-library/react-native";
import { Dimensions, StyleSheet } from "react-native";

const mockLogout = jest.fn();
const mockReplace = jest.fn();
// Read inside the hook so a test can sign in before it renders; the "mock" prefix is what lets the
// factory below reach it.
let mockAuthenticated = false;

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated, logout: mockLogout }),
}));

jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));

const WIDTH = Dimensions.get("screen").width;
// The insets renderWithProviders seeds; the panel adds 10 to the top one.
const TOP_INSET = 47;

const onDismiss = jest.fn();

function show({
  visible = true,
  theme = AppDefaultTheme,
  userTheme,
}: {
  visible?: boolean;
  theme?: typeof AppDefaultTheme | typeof AppDarkTheme;
  userTheme?: "light" | "dark" | "auto";
} = {}) {
  return renderWithProviders(<SettingsDrawer visible={visible} onDismiss={onDismiss} />, {
    theme,
    initialAtoms: userTheme ? [[userThemeAtom, userTheme]] : [],
  });
}

async function press(label: string) {
  fireEvent.press(screen.getByText(label));
  await settle();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthenticated = false;
  mockLogout.mockResolvedValue(undefined);
});

it("renders nothing while it is closed", () => {
  show({ visible: false });

  expect(screen.queryByTestId("drawer-panel")).toBeNull();
  expect(screen.queryByText("Tema")).toBeNull();
});

it("lists every setting, under the app's name", () => {
  show();

  expect(screen.getByText("Stigvidd")).toBeTruthy();
  expect(screen.getByText("Tema")).toBeTruthy();
  expect(screen.getByText("Naturguide")).toBeTruthy();
  expect(screen.getByText("Om Stigvidd")).toBeTruthy();
});

// The panel covers most of the screen, so the way out has to be obvious.
it("closes when the backdrop behind it is tapped", async () => {
  show();

  fireEvent.press(screen.getByTestId("drawer-backdrop"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
});

it("closes on the close icon", async () => {
  show();

  expect(screen.getByTestId("icon-close")).toBeTruthy();
  fireEvent.press(screen.getByTestId("drawer-close"));
  await settle();

  expect(onDismiss).toHaveBeenCalled();
});

it("closes itself on the way to the guide", async () => {
  show();

  await press("Naturguide");

  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/(settings)/guide");
  expect(onDismiss).toHaveBeenCalled();
});

it("closes itself on the way to the about screen", async () => {
  show();

  await press("Om Stigvidd");

  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/(settings)/about");
  expect(onDismiss).toHaveBeenCalled();
});

it("offers login, and not logout, to a signed-out user", () => {
  show();

  expect(screen.getByText("Logga in")).toBeTruthy();
  expect(screen.queryByText("Logga ut")).toBeNull();
});

// The (settings) stack has nowhere to land after a login, so the profile stack takes it.
it("sends login into the profile stack", async () => {
  show();

  await press("Logga in");

  expect(mockReplace).toHaveBeenCalledWith("/(tabs)/(profile-stack)/login");
  expect(onDismiss).toHaveBeenCalled();
});

it("offers logout, and not login, to a signed-in user", () => {
  mockAuthenticated = true;
  show();

  expect(screen.getByText("Logga ut")).toBeTruthy();
  expect(screen.queryByText("Logga in")).toBeNull();
});

// The profile-stack guard swaps the screen when the user atom flips, so navigating here would compete.
it("logs out without navigating anywhere", async () => {
  mockAuthenticated = true;
  show();

  await press("Logga ut");

  expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

// A logout that failed silently leaves a user who believes they are signed out.
it("says so when the logout fails, and still closes", async () => {
  mockAuthenticated = true;
  mockLogout.mockRejectedValue(new Error("keycloak nere"));
  jest.spyOn(console, "log").mockImplementation(() => {});
  const { store } = show();

  await press("Logga ut");

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error", message: "Kunde inte logga ut." });
  expect(onDismiss).toHaveBeenCalled();
});

// The icon is the theme you get by pressing, not the one you are on.
it("offers the dark theme while the light one is on", () => {
  show({ userTheme: "light" });

  expect(screen.getByTestId("icon-dark-mode")).toBeTruthy();
  expect(screen.queryByTestId("icon-light-mode")).toBeNull();
});

it("offers the light theme while the dark one is on", () => {
  show({ userTheme: "dark", theme: AppDarkTheme });

  expect(screen.getByTestId("icon-light-mode")).toBeTruthy();
  expect(screen.queryByTestId("icon-dark-mode")).toBeNull();
});

it("stores the chosen theme so it survives a restart", async () => {
  show({ userTheme: "light" });

  await press("Tema");

  expect(AsyncStorage.setItem).toHaveBeenCalledWith("my-theme", "dark");
  expect(screen.getByTestId("icon-light-mode")).toBeTruthy();
});

it("toggles back to the light theme", async () => {
  show({ userTheme: "dark", theme: AppDarkTheme });

  await press("Tema");

  expect(AsyncStorage.setItem).toHaveBeenCalledWith("my-theme", "light");
  expect(screen.getByTestId("icon-dark-mode")).toBeTruthy();
});

// Every other row leaves; the theme is the one thing you want to see change behind the menu.
it("stays open after a theme change", async () => {
  show({ userTheme: "light" });

  await press("Tema");

  expect(onDismiss).not.toHaveBeenCalled();
  expect(screen.getByTestId("drawer-panel")).toBeTruthy();
});

it("marks the theme row as the active one once it has been used", async () => {
  show({ userTheme: "light" });

  expect(screen.getByTestId("icon-dark-mode").props.color).toBe(AppDefaultTheme.colors.onSurfaceVariant);

  await press("Tema");

  expect(screen.getByTestId("icon-light-mode").props.color).toBe(AppDefaultTheme.colors.onSecondaryContainer);
});

it("hangs the panel off the right edge, over the full height of the screen", () => {
  show();

  expect(screen.getByTestId("drawer-panel")).toHaveStyle({
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: WIDTH * 0.7,
  });
});

// The panel starts at the top of the screen, so its content has to clear the notch itself.
it("keeps its content below the status bar", () => {
  show();

  expect(screen.getByTestId("drawer-panel")).toHaveStyle({ paddingTop: TOP_INSET + 10 });
});

it("draws the panel on the theme's surface, with an edge against the blurred screen", () => {
  show();

  expect(screen.getByTestId("drawer-panel")).toHaveStyle({
    backgroundColor: AppDefaultTheme.colors.surface,
    borderLeftColor: AppDefaultTheme.colors.outlineVariant,
    borderLeftWidth: 1,
  });
});

it("draws the panel on the dark theme's surface too", () => {
  show({ theme: AppDarkTheme });

  expect(screen.getByTestId("drawer-panel")).toHaveStyle({
    backgroundColor: AppDarkTheme.colors.surface,
    borderLeftColor: AppDarkTheme.colors.outlineVariant,
  });
});

// Everything outside the panel dismisses it, so the backdrop has to be the whole screen.
it("spreads the backdrop over the screen", () => {
  show();

  expect(screen.getByTestId("drawer-backdrop")).toHaveStyle(StyleSheet.absoluteFillObject);
});

// Thumb reach: the rows sit at the bottom of a full-height panel, not under the logo.
it("pins the settings to the bottom of the panel", () => {
  show();

  expect(screen.getByTestId("drawer-items")).toHaveStyle({ marginTop: "auto", paddingBottom: 45 });
});
