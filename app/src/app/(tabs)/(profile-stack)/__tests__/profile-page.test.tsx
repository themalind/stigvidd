// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { userThemeAtom } from "@/atoms/user-theme-atom";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen } from "@testing-library/react-native";
import { ActivityIndicator, StyleSheet } from "react-native";
import ProfilePageScreen from "../profile-page";

const mockLogout = jest.fn();
const mockDeleteAccount = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();

// The screen only reads the query result; the real atoms would fetch.
let mockUserQuery: { data?: unknown; isLoading: boolean; isError: boolean; error?: unknown };
let mockIncomingRequests: unknown[];
let mockIncomingSharedHikes: unknown[];

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { stigviddUserAtom: atom(() => mockUserQuery) };
});

jest.mock("@/atoms/friends-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    incomingRequestsAtom: atom(() => ({ data: mockIncomingRequests })),
    incomingSharedHikesAtom: atom(() => ({ data: mockIncomingSharedHikes })),
  };
});

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ logout: mockLogout, deleteAccount: mockDeleteAccount, isAuthenticated: true }),
}));

// The real module talks to Keycloak; the delete modal below it only needs the error class.
jest.mock("@/services/keycloak-auth", () => {
  class InvalidCredentialsError extends Error {}
  return { InvalidCredentialsError };
});

jest.mock("expo-router", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useEffect } = require("react");
  return {
    useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
    router: {
      navigate: (...args: unknown[]) => mockNavigate(...args),
      replace: (...args: unknown[]) => mockReplace(...args),
    },
  };
});

const USER = { identifier: "me", nickName: "stigfinnaren", email: "stig@example.com" };

let clock = 2_000_000;

const MENU = [
  "Mina vänner",
  "Favoriter",
  "Vill gå",
  "Skapa en promenad",
  "Mina egna promenader",
  "Promenader delade med mig",
  "Om Stigvidd",
];

function show({
  theme = AppDefaultTheme,
  userTheme = "light",
}: { theme?: typeof AppDefaultTheme | typeof AppDarkTheme; userTheme?: "light" | "dark" } = {}) {
  return renderWithProviders(<ProfilePageScreen />, { theme, initialAtoms: [[userThemeAtom, userTheme]] });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserQuery = { data: USER, isLoading: false, isError: false };
  mockIncomingRequests = [];
  mockIncomingSharedHikes = [];
  mockLogout.mockResolvedValue(undefined);
  // guardedNavigate's 500 ms debounce lives in module state that outlives each test, so the
  // clock climbs across the whole file.
  jest.spyOn(Date, "now").mockImplementation(() => (clock += 1000));
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("waits for the user rather than showing an empty profile", () => {
  mockUserQuery = { isLoading: true, isError: false };
  show();

  expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  expect(screen.queryByText("Mitt Stigvidd")).toBeNull();
});

it("shows the error instead of the menu when the user cannot be loaded", () => {
  mockUserQuery = { isLoading: false, isError: true, error: new Error("nätverket") };
  show();

  expect(screen.getByText("Något gick fel")).toBeTruthy();
  expect(screen.queryByText("Mina vänner")).toBeNull();
});

it("names the signed-in user", () => {
  show();

  expect(screen.getByText("Mitt Stigvidd")).toBeTruthy();
  expect(screen.getByText("stigfinnaren")).toBeTruthy();
  expect(screen.getByText("stig@example.com")).toBeTruthy();
});

it("lists every part of the profile", () => {
  show();

  for (const item of MENU) {
    expect(screen.getByText(item)).toBeTruthy();
  }
});

// The badge is the only thing on this screen that says someone is waiting for an answer.
it("counts the friend requests waiting", () => {
  mockIncomingRequests = [{ id: "a" }, { id: "b" }, { id: "c" }];
  show();

  expect(screen.getByText("3")).toBeTruthy();
});

it("counts the hikes shared with the user", () => {
  mockIncomingSharedHikes = [{ id: "h1" }, { id: "h2" }];
  show();

  expect(screen.getByText("2")).toBeTruthy();
});

it("shows no badge at all when nothing is waiting", () => {
  show();

  expect(screen.queryByText("0")).toBeNull();
});

it("navigates into the part of the profile that was pressed", () => {
  show();

  fireEvent.press(screen.getByText("Mina vänner"));

  expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(profile-stack)/user/friends");
});

it("sends the about row to the about screen", () => {
  show();

  fireEvent.press(screen.getByText("Om Stigvidd"));

  expect(mockNavigate).toHaveBeenCalledWith("/(tabs)/(profile-stack)/about");
});

// The profile-stack guard swaps in the login screen when the user atom flips; the screen navigates nowhere.
it("logs out without navigating", async () => {
  show();

  fireEvent.press(screen.getByText("Logga ut"));
  await settle();

  expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("says so when the logout fails", async () => {
  mockLogout.mockRejectedValue(new Error("keycloak nere"));
  jest.spyOn(console, "log").mockImplementation(() => {});
  const { store } = show();

  fireEvent.press(screen.getByText("Logga ut"));
  await settle();

  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error", message: "Kunde inte logga ut." });
});

// Deleting the account is irreversible, so the row only opens the modal that asks.
it("asks for the password before deleting the account", async () => {
  show();

  expect(screen.queryByText("Skriv in ditt lösenord")).toBeNull();
  fireEvent.press(screen.getByText("Avsluta konto"));
  await flushUntil(() => screen.queryByText("Skriv in ditt lösenord"));

  expect(screen.getByText("Skriv in ditt lösenord")).toBeTruthy();
  expect(mockDeleteAccount).not.toHaveBeenCalled();
});

it("closes the delete modal again without deleting anything", async () => {
  show();

  fireEvent.press(screen.getByText("Avsluta konto"));
  await flushUntil(() => screen.queryByTestId("delete-account-close"));
  fireEvent.press(screen.getByTestId("delete-account-close"));
  await settle();

  expect(mockDeleteAccount).not.toHaveBeenCalled();
});

it("toggles the theme from the profile header", async () => {
  show({ userTheme: "light" });

  fireEvent.press(screen.getByTestId("icon-dark-mode"));
  await settle();

  expect(AsyncStorage.setItem).toHaveBeenCalledWith("my-theme", "dark");
});

// The avatar is drawn for a light background; on the dark theme it is a different file.
it("uses the wizard that matches the chosen theme", () => {
  show({ userTheme: "light" });
  const light = screen.getByTestId("profile-avatar").props.source;

  screen.unmount();
  show({ userTheme: "dark", theme: AppDarkTheme });

  expect(screen.getByTestId("profile-avatar").props.source).not.toEqual(light);
});

it("fills the screen with the theme's background", () => {
  show();

  expect(StyleSheet.flatten(screen.getByTestId("profile-scroll").props.contentContainerStyle)).toMatchObject({
    flexGrow: 1,
    padding: 10,
    gap: 10,
    backgroundColor: AppDefaultTheme.colors.background,
  });
});

it("fills the screen with the dark theme's background too", () => {
  show({ theme: AppDarkTheme, userTheme: "dark" });

  expect(StyleSheet.flatten(screen.getByTestId("profile-scroll").props.contentContainerStyle)).toMatchObject({
    backgroundColor: AppDarkTheme.colors.background,
  });
});

it("draws the avatar as a bordered circle", () => {
  show();

  expect(screen.getByTestId("profile-avatar")).toHaveStyle({
    height: 80,
    width: 80,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: AppDefaultTheme.colors.outline,
  });
});

// The toggle belongs at the far edge of the header row, away from the name beside it.
it("pushes the theme toggle to the end of the header row", () => {
  show();

  expect(screen.getByTestId("profile-theme-toggle")).toHaveStyle({ marginLeft: "auto" });
});

// Logging out and deleting the account sit below the menu, not among it.
it("keeps the account actions apart, and underlined", () => {
  show();

  expect(screen.getByTestId("profile-account-actions")).toHaveStyle({ alignItems: "center", paddingTop: 30, gap: 20 });
  expect(screen.getByText("Logga ut")).toHaveStyle({ textDecorationLine: "underline" });
  expect(screen.getByText("Avsluta konto")).toHaveStyle({ textDecorationLine: "underline" });
});
