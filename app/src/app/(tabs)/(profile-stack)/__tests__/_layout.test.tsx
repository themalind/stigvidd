// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Tabs, router } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";
import ProfileStackLayout, { unstable_settings } from "../_layout";

let mockAuthenticated = true;

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated }),
}));

beforeEach(() => {
  mockAuthenticated = true;
});

function page(label: string) {
  return function Page() {
    return <Text>{label}</Text>;
  };
}

const PROFILE_SCREENS = [
  "login",
  "register",
  "verify-email",
  "profile-page",
  "about",
  "trail/[identifier]",
  "follow/[identifier]",
  "guide",
  "hike/[identifier]",
  "shared-hike/[identifier]",
  "hike-follow/[identifier]",
  "user/favorites",
  "user/wishlist",
  "user/my-hikes",
  "user/published-hikes",
  "user/create-hike",
  "user/shared-hikes",
  "user/friends",
  "user/friend/[identifier]",
];

function renderApp() {
  return renderRouter(
    {
      "(tabs)/_layout": () => <Tabs />,
      "(tabs)/(home)/index": page("Start"),
      "(tabs)/(profile-stack)/_layout": { default: ProfileStackLayout, unstable_settings },
      ...Object.fromEntries(PROFILE_SCREENS.map((name) => [`(tabs)/(profile-stack)/${name}`, page(name)])),
    },
    { initialUrl: "/" },
  );
}

function openFromNotification(route: string) {
  act(() => router.navigate(route as never, { withAnchor: true }));
}

it("puts the profile page beneath a screen a notification opens in an unvisited tab", async () => {
  const app = renderApp();

  openFromNotification("/(tabs)/(profile-stack)/user/shared-hikes");
  expect(app.getPathname()).toBe("/user/shared-hikes");

  act(() => router.back());
  expect(app.getPathname()).toBe("/profile-page");
  expect(screen.getByText("profile-page")).toBeTruthy();
});

it("puts the profile page beneath the friends list a friend request opens in an unvisited tab", async () => {
  const app = renderApp();

  openFromNotification("/(tabs)/(profile-stack)/user/friends");
  expect(app.getPathname()).toBe("/user/friends");

  act(() => router.back());
  expect(app.getPathname()).toBe("/profile-page");
});

it("does not stack a second copy of the screen a notification points at when it is already open", async () => {
  const app = renderApp();

  openFromNotification("/(tabs)/(profile-stack)/user/shared-hikes");
  openFromNotification("/(tabs)/(profile-stack)/user/shared-hikes");
  act(() => router.back());

  expect(app.getPathname()).toBe("/profile-page");
});

function followAFriendsHikeLive() {
  act(() => router.navigate("/(tabs)/(profile-stack)/profile-page"));
  act(() => router.push("/(tabs)/(profile-stack)/user/friends"));
  act(() => router.push({ pathname: "/(tabs)/(profile-stack)/user/friend/[identifier]", params: { identifier: "x" } }));
  act(() => router.push({ pathname: "/(tabs)/(profile-stack)/hike-follow/[identifier]", params: { identifier: "y" } }));
}

it("keeps a live screen the user is on beneath a list a notification opens, though the list is lower down", async () => {
  const app = renderApp();
  followAFriendsHikeLive();

  openFromNotification("/(tabs)/(profile-stack)/user/friends");
  expect(app.getPathname()).toBe("/user/friends");

  act(() => router.back());
  expect(app.getPathname()).toBe("/hike-follow/y");
});

it("opens a screen above the open one when the tab is mounted but the screen is not in it", async () => {
  const app = renderApp();
  act(() => router.navigate("/(tabs)/(profile-stack)/profile-page"));
  act(() => router.push("/(tabs)/(profile-stack)/user/my-hikes"));

  openFromNotification("/(tabs)/(profile-stack)/user/shared-hikes");
  expect(app.getPathname()).toBe("/user/shared-hikes");

  act(() => router.back());
  expect(app.getPathname()).toBe("/user/my-hikes");
});

it("reaches the tab from another tab after the profile tab was visited", async () => {
  const app = renderApp();
  act(() => router.navigate("/(tabs)/(profile-stack)/profile-page"));
  act(() => router.navigate("/(tabs)/(home)"));

  openFromNotification("/(tabs)/(profile-stack)/user/friends");
  expect(app.getPathname()).toBe("/user/friends");

  act(() => router.back());
  expect(app.getPathname()).toBe("/profile-page");
});

it("opens a list from another tab, over the screens the profile tab was left on", async () => {
  const app = renderApp();
  followAFriendsHikeLive();
  act(() => router.navigate("/(tabs)/(home)"));

  openFromNotification("/(tabs)/(profile-stack)/user/friends");
  expect(app.getPathname()).toBe("/user/friends");

  act(() => router.back());
  expect(app.getPathname()).toBe("/hike-follow/y");
});

it("leaves the tab when a signed-out user goes back from login", async () => {
  mockAuthenticated = false;
  const app = renderApp();

  act(() => router.navigate("/(tabs)/(profile-stack)/login", { withAnchor: true }));
  act(() => router.back());

  expect(app.getPathname()).toBe("/");
  expect(screen.getByText("Start")).toBeTruthy();
});

it("puts the profile page beneath recording opened from the start page", async () => {
  const app = renderApp();

  act(() => router.navigate("/(tabs)/(profile-stack)/user/create-hike", { withAnchor: true }));
  act(() => router.back());

  expect(app.getPathname()).toBe("/profile-page");
});

it("returns to a running recording opened again from the start page", async () => {
  const app = renderApp();
  act(() => router.navigate("/(tabs)/(profile-stack)/user/create-hike", { withAnchor: true }));
  act(() => router.navigate("/(tabs)/(home)"));

  act(() => router.navigate("/(tabs)/(profile-stack)/user/create-hike", { withAnchor: true }));
  expect(app.getPathname()).toBe("/user/create-hike");

  act(() => router.back());
  expect(app.getPathname()).toBe("/profile-page");
});

it("opens login for a signed-out user, though the anchor is a signed-in screen", async () => {
  mockAuthenticated = false;
  const app = renderApp();

  act(() => router.navigate("/(tabs)/(profile-stack)/login", { withAnchor: true }));

  expect(app.getPathname()).toBe("/login");
  expect(screen.getByText("login")).toBeTruthy();
});
