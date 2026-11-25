// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import RecordingBar from "@/components/hike/recording-bar";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { RECORDER_ROUTE } from "@/hooks/hike/useOpenActiveRecording";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockNavigate = jest.fn();
const mockPathname = jest.fn();
const mockReadHikeState = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  usePathname: () => mockPathname(),
  useNavigationContainerRef: () => ({ isReady: () => true }),
}));

const mockHikeStateListeners = new Set<() => void>();

jest.mock("@/services/location-task", () => ({
  readHikeState: () => mockReadHikeState(),
  onHikeStateChange: (listener: () => void) => {
    mockHikeStateListeners.add(listener);
    return () => mockHikeStateListeners.delete(listener);
  },
}));

const SEGMENT = { coordinates: [], distance: 1200, startTime: 0, endTime: 1000 };

function stored({ isTracking = false, segments = 0, totalDistance = 0 } = {}) {
  mockReadHikeState.mockResolvedValue({
    isTracking,
    currentSegment: isTracking ? { coordinates: [], distance: 0, startTime: 0 } : null,
    hike: { segments: Array.from({ length: segments }, () => SEGMENT), totalDistance, totalTime: 0 },
  });
}

async function show({ signedIn = true, theme = AppDefaultTheme } = {}) {
  const rendered = await renderWithProviders(<RecordingBar signedIn={signedIn} />, { theme });
  await flushUntil(() => screen.queryByTestId("recording-bar"), 5);
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname.mockReturnValue("/");
});

it("shows the distance while a hike is recording", async () => {
  stored({ isTracking: true, totalDistance: 2412 });

  await show();

  expect(screen.getByText("Spelar in")).toBeTruthy();
  expect(screen.getByText("2.41 km")).toBeTruthy();
});

it("says a hike with walked segments is paused", async () => {
  stored({ segments: 1, totalDistance: 1200 });

  await show();

  expect(screen.getByText("Pausad")).toBeTruthy();
  expect(screen.getByText("1.20 km")).toBeTruthy();
});

it("goes away as soon as the saved hike is cleared, not on the next poll", async () => {
  stored({ segments: 1, totalDistance: 1200 });
  await show();

  stored();
  mockHikeStateListeners.forEach((listener) => listener());
  await settle();

  expect(screen.queryByTestId("recording-bar")).toBeNull();
});

it("is not there without a hike in progress", async () => {
  stored();

  await show();

  expect(screen.queryByTestId("recording-bar")).toBeNull();
});

it("is not there on the recorder itself", async () => {
  stored({ isTracking: true, totalDistance: 500 });
  mockPathname.mockReturnValue("/user/create-hike");

  await show();

  expect(screen.queryByTestId("recording-bar")).toBeNull();
});

it("reads nothing for a signed-out user", async () => {
  stored({ isTracking: true });

  await show({ signedIn: false });
  await settle();

  expect(mockReadHikeState).not.toHaveBeenCalled();
  expect(screen.queryByTestId("recording-bar")).toBeNull();
});

it("opens the recorder with the profile page beneath it", async () => {
  stored({ isTracking: true, totalDistance: 500 });
  await show();

  await fireEvent.press(screen.getByTestId("recording-bar"));

  expect(mockNavigate).toHaveBeenCalledWith(RECORDER_ROUTE, { withAnchor: true });
});

it("names its action for screen readers", async () => {
  stored({ isTracking: true });

  await show();

  expect(screen.getByTestId("recording-bar")).toHaveProp("accessibilityLabel", "Öppna inspelningen");
  expect(screen.getByTestId("recording-bar")).toHaveProp("accessibilityRole", "button");
});

it("takes the theme's primary colours, in dark mode too", async () => {
  stored({ isTracking: true, totalDistance: 500 });

  await show({ theme: AppDarkTheme });

  expect(screen.getByTestId("recording-bar")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.primary });
  expect(screen.getByText("Spelar in")).toHaveStyle({ color: AppDarkTheme.colors.onPrimary });
});
