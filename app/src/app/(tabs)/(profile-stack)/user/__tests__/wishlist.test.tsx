// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import WishlistScreen from "../wishlist";

let mockWishlistQuery: {
  data?: unknown[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  refetch?: () => void;
};

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    userWishlistAtom: atom(() => mockWishlistQuery),
    removeFromWishlistAtom: atom(() => ({ mutate: jest.fn() })),
  };
});

jest.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ isAuthenticated: true, logout: jest.fn() }) }));

jest.mock("@/components/user/user-trail-collection", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ trails }: { trails: unknown[] }) =>
      ReactActual.createElement(Text, { testID: "collection" }, String(trails.length)),
  };
});

beforeEach(() => {
  mockWishlistQuery = { data: [], isLoading: false, isError: false };
});

it("lets the user retry loading the wishlist after a failure", () => {
  const refetch = jest.fn();
  mockWishlistQuery = { isLoading: false, isError: true, error: new Error("nätverket"), refetch };
  renderWithProviders(<WishlistScreen />);

  fireEvent.press(screen.getByText("Försök igen"));

  expect(refetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId("collection")).toBeNull();
});
