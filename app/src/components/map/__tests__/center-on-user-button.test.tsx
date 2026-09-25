// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The way back from a refused location permission. iOS grants one system prompt per install,
// so afterwards the settings app is the only thing that can change the answer.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import CenterOnUserButton from "@/components/map/center-on-user-button";
import { AppDefaultTheme } from "@/constants/theme";
import { USER_LOCATION_KEY } from "@/hooks/useUserLocation";
import sv from "@/i18n/locales/sv.json";
import { loadConsent, resetConsent, setConsent } from "@/services/consent";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { type CameraRef } from "@maplibre/maplibre-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { RefObject } from "react";
import { Linking } from "react-native";

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockLastKnown = jest.fn();
const mockCurrentPosition = jest.fn();

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) => mockGetPermissions(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  getLastKnownPositionAsync: (...args: unknown[]) => mockLastKnown(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockCurrentPosition(...args),
  Accuracy: { Balanced: 3, High: 4, BestForNavigation: 6 },
}));

const mockFlyTo = jest.fn();
const cameraRef = { current: { flyTo: mockFlyTo } } as unknown as RefObject<CameraRef | null>;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  resetConsent();
  await loadConsent();
  // The hook withholds the system prompt until the startup dialog is answered, and these are
  // about the button's own prompt, not that one.
  await setConsent("denied");
  // Refused for good, so mounting the hook asks for nothing. Each test re-mocks what the
  // PRESS should find.
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: false });
  mockLastKnown.mockResolvedValue(null);
  mockCurrentPosition.mockRejectedValue(new Error("no fix"));
  jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
});

afterEach(() => {
  resetConsent();
});

async function mount() {
  const rendered = renderWithProviders(<CenterOnUserButton cameraRef={cameraRef} />);
  await waitFor(() => expect(screen.getByTestId("center-on-user")).toBeOnTheScreen());
  await flushUntil(() => rendered.queryClient.getQueryData(USER_LOCATION_KEY) !== undefined);
  return rendered;
}

it("stays on the map when there is no position to fly to", async () => {
  await mount();

  expect(screen.getByTestId("center-on-user")).toBeOnTheScreen();
});

it("asks for the permission instead of flying, while the phone still allows asking", async () => {
  await mount();
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({ granted: false, canAskAgain: false });

  fireEvent.press(screen.getByTestId("center-on-user"));

  await waitFor(() => expect(mockRequestPermissions).toHaveBeenCalledTimes(1));
  expect(mockFlyTo).not.toHaveBeenCalled();
});

// The cached position is the refusal, so the grant reaches the map through a refetch.
it("refetches the position once the permission is granted", async () => {
  const { queryClient } = await mount();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });

  fireEvent.press(screen.getByTestId("center-on-user"));

  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: USER_LOCATION_KEY }));
});

// A permanent refusal leaves only the settings app, so the button opens it.
it("sends a refusal the app cannot reverse to the phone's settings, and says why", async () => {
  const { store } = await mount();

  fireEvent.press(screen.getByTestId("center-on-user"));

  await waitFor(() => expect(Linking.openSettings).toHaveBeenCalled());
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(store.get(snackbarAtom)).toMatchObject({
    visible: true,
    message: sv.map.locationBlocked,
  });
});

// Permitted, but no fix has landed yet. Asking again would be a dialog about nothing.
it("only refetches when the permission is already there", async () => {
  const { queryClient } = await mount();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });

  fireEvent.press(screen.getByTestId("center-on-user"));

  await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: USER_LOCATION_KEY }));
  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(Linking.openSettings).not.toHaveBeenCalled();
});

it("flies to the user, and asks for nothing, once there is a position", async () => {
  mockGetPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  mockLastKnown.mockResolvedValue({ coords: { latitude: 57.5, longitude: 12.5, accuracy: 9 }, timestamp: 0 });
  mockCurrentPosition.mockResolvedValue({ coords: { latitude: 57.5, longitude: 12.5, accuracy: 9 }, timestamp: 0 });
  await mount();
  // The fix arrives a render after the query settles, and the palette is what says it has.
  await waitFor(() =>
    expect(screen.getByTestId("center-on-user")).toHaveStyle({
      backgroundColor: AppDefaultTheme.colors.primary,
    }),
  );

  fireEvent.press(screen.getByTestId("center-on-user"));

  expect(mockFlyTo).toHaveBeenCalledWith({ center: [12.5, 57.5], zoom: 14, duration: 800 });
  expect(mockRequestPermissions).not.toHaveBeenCalled();
});
