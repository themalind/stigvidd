// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The launch that starts before the stored consent answer has been read back — the first
// moments of a cold start, while loadConsent is still out at storage. Its own file because
// "prompt at most once" is module state and a Jest module registry is per file.

import { useUserLocation } from "@/hooks/useUserLocation";
import { loadConsent, resetConsent, setConsent } from "@/services/consent";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act } from "@testing-library/react-native";

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

const FIX = { coords: { latitude: 57.5, longitude: 12.5, accuracy: 12 }, timestamp: 0 };

// Hydration has not landed yet, which counts as "the dialog is up".
it("waits for the answer, then asks without waiting for anything else", async () => {
  await AsyncStorage.clear();
  resetConsent();
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  mockLastKnown.mockResolvedValue(FIX);
  mockCurrentPosition.mockResolvedValue(FIX);

  let rendered: ReturnType<typeof useUserLocation> | undefined;
  function Probe() {
    rendered = useUserLocation();
    return null;
  }
  function query() {
    if (!rendered) throw new Error("expected the probe to have rendered");
    return rendered;
  }
  renderWithProviders(<Probe />);
  await flushUntil(() => query().isSuccess || query().isError);

  expect(mockRequestPermissions).not.toHaveBeenCalled();
  expect(query().data?.isFallback).toBe(true);

  // The answer lands, with no foreground return and no remount behind it.
  await act(async () => {
    await loadConsent();
    await setConsent("denied");
  });
  await flushUntil(() => query().data?.isFallback === false);

  expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  expect(query().data).toEqual({ latitude: 57.5, longitude: 12.5, isFallback: false });
});
