// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/core/api-error";
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
      review,
      onDismiss,
    }: {
      visible: boolean;
      trailIdentifier: string;
      trailName: string;
      trailLength: number;
      review?: { identifier: string };
      onDismiss: () => void;
    }) =>
      (mockModalProps({ visible, review }) ?? visible)
        ? ReactActual.createElement(
            Text,
            { testID: "add-review", onPress: onDismiss },
            `${trailIdentifier}|${trailName}|${trailLength}${review ? `|${review.identifier}` : ""}`,
          )
        : null,
  };
});

const mockGetOwnReview = jest.fn();
const mockHasReviewedTrailApi = jest.fn();
const mockModalProps = jest.fn();
jest.mock("@/api/reviews", () => ({
  getOwnReview: (...args: unknown[]) => mockGetOwnReview(...args),
  hasReviewedTrail: (...args: unknown[]) => mockHasReviewedTrailApi(...args),
}));

function trail(): Trail {
  return { identifier: TRAIL_ID, name: "Kronängsleden", trailLength: 4.2 } as Trail;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockHasReviewed = false;
});

describe("UserRating", () => {
  it("invites a rating when the trail has none from this user", async () => {
    await renderWithProviders(<UserRating trail={trail()} />);

    expect(screen.getByText("Betygsätt")).toBeTruthy();
    expect(screen.getByTestId("icon-thumb-up-off-alt")).toBeTruthy();
  });

  it("shows the trail as rated once the user has reviewed it", async () => {
    mockHasReviewed = true;
    await renderWithProviders(<UserRating trail={trail()} />);

    expect(screen.getByText("Betygsatt")).toBeTruthy();
    expect(screen.getByTestId("icon-thumb-up-alt")).toBeTruthy();
  });

  it("asks about this trail", async () => {
    await renderWithProviders(<UserRating trail={trail()} />);
    expect(mockUseHasReviewedTrail).toHaveBeenCalledWith(TRAIL_ID);
  });

  it("opens the review form with the trail it belongs to", async () => {
    await renderWithProviders(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsätt"));
    await settle();

    expect(screen.getByTestId("add-review")).toHaveTextContent(`${TRAIL_ID}|Kronängsleden|4.2`);
  });

  it("keeps the form closed until pressed", async () => {
    await renderWithProviders(<UserRating trail={trail()} />);
    expect(screen.queryByTestId("add-review")).toBeNull();
  });

  it("asks a signed-out user to sign in instead of opening the form", async () => {
    mockIsAuthenticated = false;
    await renderWithProviders(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsätt"));
    await settle();

    expect(screen.getByText("Du behöver vara inloggad för att lägga till en recension.")).toBeTruthy();
    expect(screen.queryByTestId("add-review")).toBeNull();
  });

  it("opens the user's own review for editing when the trail is already rated", async () => {
    mockHasReviewed = true;
    mockGetOwnReview.mockResolvedValue({ identifier: "r1" });
    await renderWithProviders(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsatt"));
    await settle();

    expect(mockGetOwnReview).toHaveBeenCalledWith(TRAIL_ID);
    expect(screen.getByTestId("add-review")).toHaveTextContent(`${TRAIL_ID}|Kronängsleden|4.2|r1`);
  });

  it("opens no form when the own review cannot be fetched", async () => {
    mockHasReviewed = true;
    mockGetOwnReview.mockRejectedValue(new Error("offline"));
    await renderWithProviders(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsatt"));
    await settle();

    expect(screen.queryByTestId("add-review")).toBeNull();
  });

  it("opens a new review when the cached rating is stale and the review is gone", async () => {
    mockHasReviewed = true;
    mockGetOwnReview.mockRejectedValue(new ApiError("not found", 404));
    mockHasReviewedTrailApi.mockResolvedValue(false);
    await renderWithProviders(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsatt"));
    await settle();

    expect(screen.getByTestId("add-review")).toHaveTextContent(`${TRAIL_ID}|Kronängsleden|4.2`);
    expect(screen.getByTestId("add-review")).not.toHaveTextContent("|r1");
  });

  it("keeps the edited review in the form while it closes", async () => {
    mockHasReviewed = true;
    mockGetOwnReview.mockResolvedValue({ identifier: "r1" });
    const { rerender } = await renderWithProviders(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsatt"));
    await settle();

    await fireEvent.press(screen.getByTestId("add-review"));
    await settle();
    mockModalProps.mockClear();
    await rerender(<UserRating trail={trail()} />);

    expect(mockModalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false, review: { identifier: "r1" } }),
    );
  });

  it("opens a new review, not the old one, once a deleted review is no longer counted", async () => {
    mockHasReviewed = true;
    mockGetOwnReview.mockResolvedValue({ identifier: "r1" });
    const { rerender } = await renderWithProviders(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsatt"));
    await settle();
    await fireEvent.press(screen.getByTestId("add-review"));
    await settle();

    mockHasReviewed = false;
    await rerender(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsätt"));
    await settle();

    expect(screen.getByTestId("add-review")).toHaveTextContent(`${TRAIL_ID}|Kronängsleden|4.2`);
    expect(screen.getByTestId("add-review")).not.toHaveTextContent("|r1");
  });

  it("treats an unknown review state as not yet rated", async () => {
    mockHasReviewed = undefined;
    await renderWithProviders(<UserRating trail={trail()} />);
    await fireEvent.press(screen.getByText("Betygsätt"));
    await settle();

    expect(screen.getByTestId("add-review")).toBeTruthy();
  });
});
