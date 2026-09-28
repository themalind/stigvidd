// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailFollowScreen from "@/components/map/trail-follow-screen";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { screen } from "@testing-library/react-native";

const mockGetCoordinates = jest.fn();

jest.mock("@/api/trails", () => ({
  getCoordinatesByTrailIdentifier: (...args: unknown[]) => mockGetCoordinates(...args),
}));

jest.mock("@/hooks/useTrailCard", () => ({
  useTrailCard: () => ({ card: { name: "Kvarnstigen" }, isLoading: false }),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ identifier: "trail-1" }),
}));

jest.mock("@/components/map/route-follow-view", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ path, isLoading, errorMessage }: { path: unknown[]; isLoading: boolean; errorMessage?: string }) =>
      ReactActual.createElement(
        Text,
        { testID: "route-follow-view" },
        `${path.length}|${isLoading ? "loading" : "idle"}|${errorMessage ?? ""}`,
      ),
  };
});

function view() {
  return screen.getByTestId("route-follow-view").props.children as string;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("says the map data could not be loaded when the route request fails", async () => {
  mockGetCoordinates.mockRejectedValue(new Error("nätverket"));

  renderWithProviders(<TrailFollowScreen />);
  await flushUntil(() => view().startsWith("0|idle"));

  expect(view()).toBe("0|idle|Kunde inte ladda kartdata");
});

it("says the map data could not be loaded when the route has nothing to draw", async () => {
  mockGetCoordinates.mockResolvedValue({ coordinates: "[]" });

  renderWithProviders(<TrailFollowScreen />);
  await flushUntil(() => view().startsWith("0|idle"));

  expect(view()).toBe("0|idle|Kunde inte ladda kartdata");
});

it("draws the route without a message when it loads", async () => {
  mockGetCoordinates.mockResolvedValue({
    coordinates: JSON.stringify([
      { latitude: 57.7, longitude: 12.9 },
      { latitude: 57.71, longitude: 12.91 },
    ]),
  });

  renderWithProviders(<TrailFollowScreen />);
  await flushUntil(() => view().includes("idle"));

  expect(view()).toBe("2|idle|");
});
