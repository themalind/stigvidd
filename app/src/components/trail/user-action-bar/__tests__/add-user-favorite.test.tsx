// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import AddToUserFavorite from "@/components/trail/user-action-bar/add-user-favorite";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act, fireEvent, screen } from "@testing-library/react-native";

const TRAIL_ID = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

// The real atoms are jotai-tanstack-query mutations with their own suite; what this button
// decides is which of them to call, so they are stand-ins that record the call.
const mockAdd = jest.fn();
const mockRemove = jest.fn();
let mockFavorites: { identifier: string }[] = [];
let mockAddPending = false;
let mockRemovePending = false;

jest.mock("@/atoms/user-atoms", () => {
  const { atom } = jest.requireActual("jotai");
  return {
    userFavoritesAtom: atom(() => ({ data: mockFavorites })),
    addToFavoritesAtom: atom(() => ({ mutate: mockAdd, isPending: mockAddPending })),
    removeFromFavoritesAtom: atom(() => ({ mutate: mockRemove, isPending: mockRemovePending })),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockFavorites = [];
  mockAddPending = false;
  mockRemovePending = false;
});

// The button's press target is the label; the icon next to it carries the state.
function press() {
  fireEvent.press(screen.getByText("Favorit"));
}

describe("AddToUserFavorite", () => {
  it("shows an outlined heart when the trail is not a favourite", () => {
    renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
    expect(screen.getByTestId("icon-favorite-border")).toBeTruthy();
  });

  it("shows a filled heart when the trail is already a favourite", () => {
    mockFavorites = [{ identifier: TRAIL_ID }];
    renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
    expect(screen.getByTestId("icon-favorite")).toBeTruthy();
  });

  it("ignores a favourite belonging to another trail", () => {
    mockFavorites = [{ identifier: "another-trail" }];
    renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
    expect(screen.getByTestId("icon-favorite-border")).toBeTruthy();
  });

  describe("when signed out", () => {
    beforeEach(() => {
      mockIsAuthenticated = false;
    });

    it("asks the user to sign in instead of mutating", async () => {
      renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
      press();
      await settle();

      expect(screen.getByText("Du behöver vara inloggad för att lägga till i favoriter.")).toBeTruthy();
      expect(mockAdd).not.toHaveBeenCalled();
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("shows no dialog until the button is pressed", () => {
      renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
      expect(screen.queryByText("Du behöver vara inloggad för att lägga till i favoriter.")).toBeNull();
    });
  });

  describe("when signed in", () => {
    it("adds the trail when it is not a favourite yet", async () => {
      renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
      press();
      await settle();

      expect(mockAdd).toHaveBeenCalledWith(TRAIL_ID, expect.objectContaining({ onError: expect.any(Function) }));
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it("removes the trail when it already is one", async () => {
      mockFavorites = [{ identifier: TRAIL_ID }];
      renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
      press();
      await settle();

      expect(mockRemove).toHaveBeenCalledWith(TRAIL_ID, expect.objectContaining({ onError: expect.any(Function) }));
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("does not open the sign-in dialog", async () => {
      renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
      press();
      await settle();

      expect(screen.queryByText("Du behöver vara inloggad för att lägga till i favoriter.")).toBeNull();
    });
  });

  describe("while a mutation is in flight", () => {
    it("is disabled during an add", async () => {
      mockAddPending = true;
      renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
      press();
      await settle();

      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("is disabled during a remove", async () => {
      mockRemovePending = true;
      mockFavorites = [{ identifier: TRAIL_ID }];
      renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
      press();
      await settle();

      expect(mockRemove).not.toHaveBeenCalled();
    });
  });

  describe("when the mutation fails", () => {
    async function failWith(error: unknown) {
      const { store } = renderWithProviders(<AddToUserFavorite trailIdentifier={TRAIL_ID} />);
      press();
      await settle();

      const { onError } = mockAdd.mock.calls[0][1] as { onError: (e: unknown) => void };
      await act(async () => onError(error));
      return store;
    }

    // A 409 is the server saying the trail is already listed, which is not an error the user
    // needs to see as one.
    it("warns rather than errors on a 409", async () => {
      const store = await failWith(new ApiError("HTTP error 409", 409));
      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "warning",
        message: "Leden finns redan i listan!",
      });
    });

    it("reports any other ApiError status as an error", async () => {
      const store = await failWith(new ApiError("HTTP error 500", 500));
      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error", message: "HTTP error 500" });
    });

    it("shows the message of a plain Error", async () => {
      const store = await failWith(new Error("Nätverket är nere"));
      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error", message: "Nätverket är nere" });
    });

    it("falls back to a generic message for a thrown non-Error", async () => {
      const store = await failWith("kaos");
      expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error", message: "Ett fel uppstod" });
    });
  });
});
