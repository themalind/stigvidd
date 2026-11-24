// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import FavoritesScreen from "../favorites";

let mockFavoritesQuery: {
  data?: unknown[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch?: () => void;
};
const mockRemove = jest.fn();

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    userFavoritesAtom: atom(() => mockFavoritesQuery),
    removeFromFavoritesAtom: atom(() => ({ mutate: mockRemove })),
  };
});

jest.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ isAuthenticated: true, logout: jest.fn() }) }));

jest.mock("@/components/user/user-trail-collection", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ trails, title, onDelete }: { trails: unknown[]; title: string; onDelete: (id: string) => void }) =>
      ReactActual.createElement(
        Pressable,
        { testID: "collection", onPress: () => onDelete("t1") },
        ReactActual.createElement(Text, null, `${title}: ${trails.length}`),
      ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFavoritesQuery = { data: [], isLoading: false, isError: false };
});

it("shows the favourites under their own title", async () => {
  mockFavoritesQuery = { data: [{}, {}, {}], isLoading: false, isError: false };
  await renderWithProviders(<FavoritesScreen />);

  expect(screen.getByTestId("collection")).toHaveTextContent("Mina favoriter: 3");
});

it("removes a trail from the favourites, not from another list", async () => {
  await renderWithProviders(<FavoritesScreen />);

  await fireEvent.press(screen.getByTestId("collection"));

  expect(mockRemove).toHaveBeenCalledWith("t1");
});

it("shows only the spinner while loading", async () => {
  mockFavoritesQuery = { isLoading: true, isError: false };
  await renderWithProviders(<FavoritesScreen />);

  expect(screen.queryByTestId("collection")).toBeNull();
});

it("lets the user retry loading the favourites after a failure", async () => {
  const refetch = jest.fn();
  mockFavoritesQuery = { isLoading: false, isError: true, error: new Error("nätverket"), refetch };
  await renderWithProviders(<FavoritesScreen />);

  await fireEvent.press(screen.getByText("Försök igen"));

  expect(refetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("collection")).toBeNull();
});

it("keeps the favourites on screen when a later refetch fails", async () => {
  mockFavoritesQuery = { data: [{}, {}], isLoading: false, isError: true, error: new Error("nätverket") };
  await renderWithProviders(<FavoritesScreen />);

  expect(screen.getByTestId("collection")).toHaveTextContent("Mina favoriter: 2");
  expect(screen.queryByText("Försök igen")).toBeNull();
});
