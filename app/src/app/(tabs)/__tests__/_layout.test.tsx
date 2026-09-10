// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { pendingNotificationsCountAtom } from "@/atoms/friends-atoms";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";
import type { ReactElement } from "react";
import TabsLayout from "../_layout";

const mockPathname = jest.fn();
const mockSegments = jest.fn();
const mockIsAuthenticated = jest.fn();

// The navigator is React Navigation's; the layout owns the options it hands it, which the double records.
jest.mock("expo-router", () => {
  const ReactActual = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const Tabs = ({ children, screenOptions: options }: { children: React.ReactNode; screenOptions: object }) => {
    Object.assign(jest.requireMock("expo-router").__options, options);
    return ReactActual.createElement(View, { testID: "tabs" }, children);
  };
  const Screen = ({ name, options }: { name: string; options: object }) => {
    jest.requireMock("expo-router").__screens[name] = options ?? {};
    return null;
  };
  Screen.displayName = "Tabs.Screen";
  Tabs.Screen = Screen;
  return {
    Tabs,
    usePathname: () => mockPathname(),
    useSegments: () => mockSegments(),
    __options: {},
    __screens: {} as Record<string, object>,
  };
});

jest.mock("@/components/header", () => {
  const ReactActual = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return { __esModule: true, default: () => ReactActual.createElement(View, { testID: "app-header" }) };
});

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated() }),
}));

// The real one is derived from two query atoms, which a test cannot write to.
jest.mock("@/atoms/friends-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return { pendingNotificationsCountAtom: atom(0) };
});

const router = jest.requireMock("expo-router");

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(router.__options)) delete router.__options[key];
  for (const key of Object.keys(router.__screens)) delete router.__screens[key];
  mockPathname.mockReturnValue("/");
  mockSegments.mockReturnValue(["(tabs)", "(home)"]);
  mockIsAuthenticated.mockReturnValue(true);
});

function show(theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme, pending = 0) {
  return renderWithProviders(<TabsLayout />, {
    theme,
    initialAtoms: [[pendingNotificationsCountAtom, pending] as [typeof pendingNotificationsCountAtom, unknown]],
  });
}

function options(): Record<string, any> {
  return router.__options;
}

function tab(name: string) {
  return router.__screens[name] as Record<string, any>;
}

// The navigator calls tabBarIcon with the tab's state; calling it directly shows the glyph for each state.
function icon(name: string, focused: boolean): ReactElement<Record<string, any>> {
  return tab(name).tabBarIcon({ focused }) as ReactElement<Record<string, any>>;
}

it("carries the four tabs a walker navigates by, in order", () => {
  show();

  expect(Object.keys(router.__screens)).toEqual(["(home)", "(map)", "(trails-tab)", "(profile-stack)", "(settings)"]);
  expect(tab("(home)").title).toBe("Start");
  expect(tab("(map)").title).toBe("Karta");
  expect(tab("(trails-tab)").title).toBe("Vandring");
  expect(tab("(profile-stack)").title).toBe("Profil");
});

// Settings is reached from the drawer, so it is registered without a tab of its own.
it("keeps settings off the tab bar", () => {
  show();

  expect(tab("(settings)").href).toBeNull();
  expect(tab("(settings)").tabBarIcon).toBeUndefined();
});

it("shows the app header above the tabs", () => {
  show();

  expect(screen.getByTestId("app-header")).toBeTruthy();
  expect(screen.getByTestId("tabs")).toBeTruthy();
});

// Login and register are full-screen views, so they carry no header.
it.each(["/settings/login", "/register", "/user/login"])("hides the header on %s", (path) => {
  mockPathname.mockReturnValue(path);
  mockSegments.mockReturnValue(["(tabs)", "(settings)"]);
  show();

  expect(screen.queryByTestId("app-header")).toBeNull();
});

it("keeps the header on every other screen", () => {
  mockPathname.mockReturnValue("/trail/kvarnstigen");
  mockSegments.mockReturnValue(["(tabs)", "(trails-tab)"]);
  show();

  expect(screen.getByTestId("app-header")).toBeTruthy();
});

// On the profile tab the pathname lags the Stack.Protected swap, so the header follows who is signed in.
it("hides the header on the profile tab while nobody is signed in", () => {
  mockSegments.mockReturnValue(["(tabs)", "(profile-stack)"]);
  mockPathname.mockReturnValue("/user");
  mockIsAuthenticated.mockReturnValue(false);
  show();

  expect(screen.queryByTestId("app-header")).toBeNull();
});

it("shows the header on the profile tab as soon as someone is", () => {
  mockSegments.mockReturnValue(["(tabs)", "(profile-stack)"]);
  mockPathname.mockReturnValue("/user/login");
  mockIsAuthenticated.mockReturnValue(true);
  show();

  expect(screen.getByTestId("app-header")).toBeTruthy();
});

// The other tabs keep the pathname check: the settings login is a screen of its own.
it("leaves the other tabs' header to the path, not to who is signed in", () => {
  mockSegments.mockReturnValue(["(tabs)", "(home)"]);
  mockPathname.mockReturnValue("/");
  mockIsAuthenticated.mockReturnValue(false);
  show();

  expect(screen.getByTestId("app-header")).toBeTruthy();
});

it("draws its own header instead of the navigator's", () => {
  show();

  expect(options().headerShown).toBe(false);
});

// The glyphs are labelled by the title above them, so the bar carries no captions.
it("lets the icons speak for themselves", () => {
  show();

  expect(options().tabBarShowLabel).toBe(false);
  expect(options().tabBarIconStyle).toEqual({ marginTop: 8 });
});

// Black and white, not the theme's surface: the bar sits against the system navigation bar.
it("paints the tab bar white in the light theme", () => {
  show();

  expect(options().tabBarStyle).toEqual({
    backgroundColor: "#ffffff",
    borderTopColor: AppDefaultTheme.colors.outline,
  });
});

it("paints the tab bar black in the dark theme", () => {
  show(AppDarkTheme);

  expect(options().tabBarStyle).toEqual({
    backgroundColor: "#000000",
    borderTopColor: AppDarkTheme.colors.outline,
  });
});

// The bar paints its own background behind itself, so the screen never shows through.
it("backs the bar with the same colour it is painted", () => {
  show();
  const background = options().tabBarBackground() as ReactElement<Record<string, any>>;

  expect(background.props.style).toEqual({ flex: 1, backgroundColor: "#ffffff" });
});

it("backs the bar in black in the dark theme too", () => {
  show(AppDarkTheme);
  const background = options().tabBarBackground() as ReactElement<Record<string, any>>;

  expect(background.props.style).toEqual({ flex: 1, backgroundColor: "#000000" });
});

it("marks the tab being looked at, and leaves the rest plain", () => {
  show();

  expect(options().tabBarActiveTintColor).toBe(AppDefaultTheme.colors.onTertiaryContainer);
  expect(options().tabBarInactiveTintColor).toBe(AppDefaultTheme.colors.onBackground);
});

// The focused tab fills its glyph in, so the bar reads without labels.
it.each([
  ["(home)", "home", "home-outline"],
  ["(map)", "map", "map-o"],
  ["(trails-tab)", "trail-sign-sharp", "trail-sign-outline"],
  ["(profile-stack)", "account-box", "account-box-outline"],
])("fills in %s's glyph when it is the open tab", (name, filled, outline) => {
  show();

  expect(icon(name, true).props.name).toBe(filled);
  expect(icon(name, false).props.name).toBe(outline);
});

it.each(["(home)", "(map)", "(trails-tab)", "(profile-stack)"])("colours %s by whether it is open", (name) => {
  show();

  expect(icon(name, true).props.color).toBe(AppDefaultTheme.colors.onTertiaryContainer);
  expect(icon(name, false).props.color).toBe(AppDefaultTheme.colors.onBackground);
});

it.each(["(home)", "(trails-tab)", "(profile-stack)"])("draws %s's glyph at the same size either way", (name) => {
  show();

  expect(icon(name, true).props.size).toBe(30);
  expect(icon(name, false).props.size).toBe(30);
});

// The map outline sits optically larger than the filled glyph, so it is drawn a few points smaller.
it("draws the map's outline smaller than its filled glyph", () => {
  show();

  expect(icon("(map)", true).props.size).toBe(28);
  expect(icon("(map)", false).props.size).toBe(25);
});

it("counts waiting friend requests and shared walks on the profile tab", () => {
  show(AppDefaultTheme, 3);

  expect(tab("(profile-stack)").tabBarBadge).toBe(3);
  expect(tab("(profile-stack)").tabBarBadgeStyle).toEqual({
    color: AppDefaultTheme.colors.onTertiary,
    backgroundColor: AppDefaultTheme.colors.tertiary,
  });
});

// A badge reading zero is worse than no badge: it draws the eye to nothing.
it("shows no badge when nothing is waiting", () => {
  show(AppDefaultTheme, 0);

  expect(tab("(profile-stack)").tabBarBadge).toBeUndefined();
});

it("badges a single waiting request as readily as several", () => {
  show(AppDefaultTheme, 1);

  expect(tab("(profile-stack)").tabBarBadge).toBe(1);
});

it("puts the badge on no tab but the profile", () => {
  show(AppDefaultTheme, 2);

  expect(tab("(home)").tabBarBadge).toBeUndefined();
  expect(tab("(map)").tabBarBadge).toBeUndefined();
  expect(tab("(trails-tab)").tabBarBadge).toBeUndefined();
});

it("carries the dark theme through to the glyphs and the badge", () => {
  show(AppDarkTheme, 1);

  expect(icon("(home)", true).props.color).toBe(AppDarkTheme.colors.onTertiaryContainer);
  expect(icon("(home)", false).props.color).toBe(AppDarkTheme.colors.onBackground);
  expect(tab("(profile-stack)").tabBarBadgeStyle).toEqual({
    color: AppDarkTheme.colors.onTertiary,
    backgroundColor: AppDarkTheme.colors.tertiary,
  });
});
