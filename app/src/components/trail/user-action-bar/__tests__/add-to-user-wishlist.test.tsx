// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import AddToUserWishlist from "@/components/trail/user-action-bar/add-to-user-wishlist";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const TRAIL_ID = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

const mockAdd = jest.fn();
const mockRemove = jest.fn();
let mockWishlist: { identifier: string }[] = [];
let mockAddPending = false;
let mockRemovePending = false;

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    userWishlistAtom: atom(() => ({ data: mockWishlist })),
    addToWishlistAtom: atom(() => ({ mutate: mockAdd, isPending: mockAddPending })),
    removeFromWishlistAtom: atom(() => ({ mutate: mockRemove, isPending: mockRemovePending })),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockWishlist = [];
  mockAddPending = false;
  mockRemovePending = false;
});

function press() {
  fireEvent.press(screen.getByText("Vill gå"));
}

describe("AddToUserWishlist", () => {
  it("shows a plus when the trail is not on the list", () => {
    renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
    expect(screen.getByTestId("icon-add")).toBeTruthy();
  });

  it("shows a check when the trail is on the list", () => {
    mockWishlist = [{ identifier: TRAIL_ID }];
    renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
    expect(screen.getByTestId("icon-check")).toBeTruthy();
  });

  it("ignores an entry belonging to another trail", () => {
    mockWishlist = [{ identifier: "another-trail" }];
    renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
    expect(screen.getByTestId("icon-add")).toBeTruthy();
  });

  it("asks a signed-out user to sign in instead of mutating", async () => {
    mockIsAuthenticated = false;
    renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
    press();
    await settle();

    expect(screen.getByText("Du behöver vara inloggad för att spara promenader.")).toBeTruthy();
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("adds the trail when it is not listed yet", async () => {
    renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
    press();
    await settle();

    expect(mockAdd).toHaveBeenCalledWith(TRAIL_ID, expect.objectContaining({ onError: expect.any(Function) }));
    expect(mockRemove).not.toHaveBeenCalled();
  });

  // The removal carries no onError handler, so a failed removal is silent.
  it("removes the trail with no error handling when it is listed", async () => {
    mockWishlist = [{ identifier: TRAIL_ID }];
    renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
    press();
    await settle();

    expect(mockRemove).toHaveBeenCalledWith(TRAIL_ID);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("is disabled while an add is in flight", async () => {
    mockAddPending = true;
    renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
    press();
    await settle();

    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("is disabled while a removal is in flight", async () => {
    mockRemovePending = true;
    mockWishlist = [{ identifier: TRAIL_ID }];
    renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
    press();
    await settle();

    expect(mockRemove).not.toHaveBeenCalled();
  });

  describe("when the add fails", () => {
    async function failWith(error: unknown) {
      const { store } = renderWithProviders(<AddToUserWishlist trailIdentifier={TRAIL_ID} />);
      press();
      await settle();

      const { onError } = mockAdd.mock.calls[0][1] as { onError: (e: unknown) => void };
      await act(async () => onError(error));
      return store;
    }

    it("warns rather than errors on a 409", async () => {
      const store = await failWith(new ApiError("HTTP error 409", 409));
      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "warning",
        message: "Leden finns redan i listan!",
      });
    });

    it("reports any other status as an error", async () => {
      const store = await failWith(new ApiError("HTTP error 500", 500));
      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error" });
    });

    // Unlike the favourite button this one has no message of its own, so the raw error
    // reaches the snackbar.
    it("shows the stringified error", async () => {
      const store = await failWith(new Error("Nätverket är nere"));
      expect(store.get(snackbarAtom).message).toBe("Error: Nätverket är nere");
    });
  });
});
