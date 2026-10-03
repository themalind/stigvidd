// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import OfflineBanner from "@/components/offline-banner";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { renderWithProviders } from "@/test/render";
import { onlineManager } from "@tanstack/react-query";
import { act, screen } from "@testing-library/react-native";

function show(clearStatusBar = false, theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  return renderWithProviders(<OfflineBanner clearStatusBar={clearStatusBar} />, { theme });
}

afterEach(() => {
  onlineManager.setOnline(true);
});

it("stays out of the way while online", () => {
  show();

  expect(screen.queryByTestId("offline-banner")).toBeNull();
});

it("says there is no connection while offline", () => {
  onlineManager.setOnline(false);
  show();

  expect(screen.getByTestId("offline-banner")).toBeTruthy();
  expect(screen.getByText("Ingen anslutning")).toBeTruthy();
});

it("comes up when the connection drops and goes when it returns", async () => {
  show();

  await act(async () => onlineManager.setOnline(false));
  expect(screen.getByTestId("offline-banner")).toBeTruthy();

  await act(async () => onlineManager.setOnline(true));
  expect(screen.queryByTestId("offline-banner")).toBeNull();
});

it("announces itself to screen readers", () => {
  onlineManager.setOnline(false);
  show();

  expect(screen.getByTestId("offline-banner")).toHaveProp("accessibilityLiveRegion", "polite");
  expect(screen.getByTestId("offline-banner")).toHaveProp("accessibilityRole", "alert");
});

it("uses the theme's inverse colours, in dark mode too", () => {
  onlineManager.setOnline(false);
  show(false, AppDarkTheme);

  expect(screen.getByTestId("offline-banner")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.inverseSurface });
  expect(screen.getByText("Ingen anslutning")).toHaveStyle({ color: AppDarkTheme.colors.inverseOnSurface });
});

it("sits flush under the header", () => {
  onlineManager.setOnline(false);
  show(false);

  expect(screen.getByTestId("offline-banner")).toHaveStyle({ paddingTop: 4 });
});

it("clears the status bar itself when there is no header above it", () => {
  onlineManager.setOnline(false);
  show(true);

  // renderWithProviders gives a 47 pt top inset. keep-comment: fixture value
  expect(screen.getByTestId("offline-banner")).toHaveStyle({ paddingTop: 47 + 4 });
});
