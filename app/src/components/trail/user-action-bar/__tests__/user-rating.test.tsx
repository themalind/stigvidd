// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import UserRating from "@/components/trail/user-action-bar/user-rating";
import { Trail } from "@/data/types";
import { settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const TRAIL_ID = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

let mockHasReviewed: boolean | undefined = false;
jest.mock("@/hooks/review/useHasReviewedTrail", () => ({
  useHasReviewedTrail: (...args: unknown[]) => {
    mockUseHasReviewedTrail(...args);
    return { data: mockHasReviewed };
  },
}));
const mockUseHasReviewedTrail = jest.fn();

// The review modal has its own suite; what this button decides is whether to open it and with what.
jest.mock("@/components/review/add/add-review-modal", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({
      visible,
      trailIdentifier,
      trailName,
      trailLength,
      onDismiss,
    }: {
      visible: boolean;
      trailIdentifier: string;
      trailName: string;
      trailLength: number;
      onDismiss: () => void;
    }) =>
      visible
        ? ReactActual.createElement(
            Text,
            { testID: "add-review", onPress: onDismiss },
            `${trailIdentifier}|${trailName}|${trailLength}`,
          )
        : null,
  };
});

function trail(): Trail {
  return { identifier: TRAIL_ID, name: "Kronängsleden", trailLength: 4.2 } as Trail;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockHasReviewed = false;
});

describe("UserRating", () => {
  it("invites a rating when the trail has none from this user", () => {
    renderWithProviders(<UserRating trail={trail()} />);

    expect(screen.getByText("Betygsätt")).toBeTruthy();
    expect(screen.getByTestId("icon-thumb-up-off-alt")).toBeTruthy();
  });

  it("shows the trail as rated once the user has reviewed it", () => {
    mockHasReviewed = true;
    renderWithProviders(<UserRating trail={trail()} />);

    expect(screen.getByText("Betygsatt")).toBeTruthy();
    expect(screen.getByTestId("icon-thumb-up-alt")).toBeTruthy();
  });

  it("asks about this trail", () => {
    renderWithProviders(<UserRating trail={trail()} />);
    expect(mockUseHasReviewedTrail).toHaveBeenCalledWith(TRAIL_ID);
  });

  it("opens the review form with the trail it belongs to", async () => {
    renderWithProviders(<UserRating trail={trail()} />);
    fireEvent.press(screen.getByText("Betygsätt"));
    await settle();

    expect(screen.getByTestId("add-review")).toHaveTextContent(`${TRAIL_ID}|Kronängsleden|4.2`);
  });

  it("keeps the form closed until pressed", () => {
    renderWithProviders(<UserRating trail={trail()} />);
    expect(screen.queryByTestId("add-review")).toBeNull();
  });

  it("asks a signed-out user to sign in instead of opening the form", async () => {
    mockIsAuthenticated = false;
    renderWithProviders(<UserRating trail={trail()} />);
    fireEvent.press(screen.getByText("Betygsätt"));
    await settle();

    expect(screen.getByText("Du behöver vara inloggad för att lägga till en recension.")).toBeTruthy();
    expect(screen.queryByTestId("add-review")).toBeNull();
  });

  // Editing an existing review is not built, so a second attempt has to be turned away rather
  // than opening a form that would post a duplicate.
  it("warns instead of opening the form when the trail is already rated", async () => {
    mockHasReviewed = true;
    const { store } = renderWithProviders(<UserRating trail={trail()} />);
    fireEvent.press(screen.getByText("Betygsatt"));
    await settle();

    expect(store.get(snackbarAtom)).toMatchObject({
      visible: true,
      type: "warning",
      message: "Du har redan betygsatt den här leden.",
    });
    expect(screen.queryByTestId("add-review")).toBeNull();
  });

  it("treats an unknown review state as not yet rated", async () => {
    mockHasReviewed = undefined;
    renderWithProviders(<UserRating trail={trail()} />);
    fireEvent.press(screen.getByText("Betygsätt"));
    await settle();

    expect(screen.getByTestId("add-review")).toBeTruthy();
  });

  it("refreshes the trail when the form closes, so the new rating is shown", async () => {
    const { queryClient } = renderWithProviders(<UserRating trail={trail()} />);
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");

    fireEvent.press(screen.getByText("Betygsätt"));
    await settle();
    fireEvent.press(screen.getByTestId("add-review"));
    await settle();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["trail", TRAIL_ID] });
  });
});
