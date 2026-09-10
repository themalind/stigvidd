// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

// The one prompt a launch gets, accepted. The launch in which it is refused is
// useUserLocation-permission.test.tsx; a Jest module registry is per file, so each of the
// two files is its own launch.

import { useUserLocation } from "@/hooks/useUserLocation";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";

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

it("goes on to fetch a position once the user accepts at the dialog", async () => {
  mockGetPermissions.mockResolvedValue({ granted: false, canAskAgain: true });
  mockRequestPermissions.mockResolvedValue({ granted: true, canAskAgain: false });
  mockLastKnown.mockResolvedValue(FIX);
  mockCurrentPosition.mockResolvedValue(FIX);

  let query!: ReturnType<typeof useUserLocation>;
  function Probe() {
    query = useUserLocation();
    return null;
  }
  renderWithProviders(<Probe />);
  await flushUntil(() => query.isSuccess || query.isError);

  expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
  expect(query.data).toEqual({ latitude: 57.5, longitude: 12.5, isFallback: false });
});
