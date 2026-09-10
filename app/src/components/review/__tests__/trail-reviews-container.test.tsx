// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import TrailReviewsContainer from "@/components/review/trail-reviews-container";
import { AppDarkTheme, AppDefaultTheme } from "@/constants/theme";
import { PagedReviewResponse, Review, Trail } from "@/data/types";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";
import { createRef } from "react";
import { ActivityIndicator, View } from "react-native";

const mockGetReviews = jest.fn();
const mockNavigate = jest.fn();

jest.mock("@/api/reviews", () => ({
  getReviewsByTrailIdentifier: (...args: unknown[]) => mockGetReviews(...args),
}));

let mockHasReviewed: boolean | undefined = false;
jest.mock("@/hooks/review/useHasReviewedTrail", () => ({
  useHasReviewedTrail: () => ({ data: mockHasReviewed }),
}));

let mockIsAuthenticated = true;
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

// The list itself has its own suite; what this container decides is which reviews reach it.
jest.mock("@/components/review/review-section", () => {
  const { Text } = jest.requireActual("react-native");
  const ReactActual = jest.requireActual("react");
  return {
    __esModule: true,
    default: ({ reviews }: { reviews: { identifier: string }[] }) =>
      ReactActual.createElement(Text, { testID: "review-section" }, reviews.map((r) => r.identifier).join(",")),
  };
});

// The modal is a Portal over a form with its own suite; only the props it opens with matter.
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
    }: {
      visible: boolean;
      trailIdentifier: string;
      trailName: string;
      trailLength: number;
    }) =>
      visible
        ? ReactActual.createElement(
            Text,
            { testID: "add-review-modal" },
            `${trailIdentifier}|${trailName}|${trailLength}`,
          )
        : null,
  };
});

const TRAIL_ID = "8d2b0f4c-2a11-4a0e-9e6f-7c3b5d1a2f90";

function trail(): Trail {
  return { identifier: TRAIL_ID, name: "Kvarnstigen", trailLength: 4.2 } as Trail;
}

function review(identifier: string): Review {
  return {
    identifier,
    rating: 4,
    userName: "Alva",
    createdAt: "2026-05-01T10:00:00Z",
    userIdentifier: "u1",
    trailIdentifier: TRAIL_ID,
  };
}

function page(overrides: Partial<PagedReviewResponse> = {}): PagedReviewResponse {
  return { reviews: [review("r1")], hasMore: false, page: 0, total: 1, ...overrides };
}

const onReviewsLoaded = jest.fn();

async function show(theme: typeof AppDefaultTheme | typeof AppDarkTheme = AppDefaultTheme) {
  const rendered = renderWithProviders(
    <TrailReviewsContainer
      trail={trail()}
      surfaceToScrollToRef={createRef<View>()}
      onReviewsLoaded={onReviewsLoaded}
    />,
    { theme },
  );
  await flushUntil(() => screen.queryByText("Recensioner") ?? screen.queryByText("Något gick fel"));
  return rendered;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHasReviewed = false;
  mockIsAuthenticated = true;
  mockGetReviews.mockResolvedValue(page());
});

it("asks for the first five reviews of this trail", async () => {
  await show();

  expect(mockGetReviews).toHaveBeenCalledWith(TRAIL_ID, 0, 5);
});

it("shows a spinner rather than an empty review list while the first page is in flight", async () => {
  let release: (value: PagedReviewResponse) => void = () => {};
  mockGetReviews.mockReturnValue(new Promise<PagedReviewResponse>((resolve) => (release = resolve)));

  renderWithProviders(<TrailReviewsContainer trail={trail()} surfaceToScrollToRef={createRef<View>()} />);
  await settle();

  expect(screen.UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();
  expect(screen.queryByText("Det finns inga recensioner här ännu.")).toBeNull();

  release(page());
  await flushUntil(() => screen.queryByText("Recensioner"));
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
});

// The count is the server's total, not the number of pages fetched so far.
it("counts every review on the trail, not the ones loaded", async () => {
  mockGetReviews.mockResolvedValue(page({ reviews: [review("r1"), review("r2")], hasMore: true, total: 17 }));

  await show();

  expect(screen.getByText("(17)")).toBeTruthy();
});

it("says so when the trail has no reviews yet", async () => {
  mockGetReviews.mockResolvedValue(page({ reviews: [], hasMore: false, total: 0 }));

  await show();

  expect(screen.getByText("Det finns inga recensioner här ännu.")).toBeTruthy();
  expect(screen.getByText("(0)")).toBeTruthy();
  expect(screen.queryByTestId("review-section")).toBeNull();
});

it("hands the loaded reviews and the total up to the screen", async () => {
  mockGetReviews.mockResolvedValue(page({ reviews: [review("r1"), review("r2")], total: 9 }));

  await show();

  expect(onReviewsLoaded).toHaveBeenLastCalledWith(
    [expect.objectContaining({ identifier: "r1" }), expect.objectContaining({ identifier: "r2" })],
    9,
  );
});

it("offers no load-more button when the first page is the whole list", async () => {
  await show();

  expect(screen.getByTestId("review-section")).toHaveTextContent("r1");
  expect(screen.queryByText("Ladda fler")).toBeNull();
});

it("appends the next page below the ones already shown", async () => {
  mockGetReviews.mockResolvedValueOnce(page({ reviews: [review("r1")], hasMore: true, total: 2 }));
  mockGetReviews.mockResolvedValueOnce(page({ reviews: [review("r2")], hasMore: false, page: 1, total: 2 }));

  await show();
  fireEvent.press(screen.getByText("Ladda fler"));
  await flushUntil(() => screen.getByTestId("review-section").props.children === "r1,r2");

  expect(mockGetReviews).toHaveBeenLastCalledWith(TRAIL_ID, 1, 5);
  expect(screen.getByTestId("review-section")).toHaveTextContent("r1,r2");
  expect(screen.queryByText("Ladda fler")).toBeNull();
});

// Without the disable, a second press starts the same page over again.
it("disables the load-more button while the next page is loading", async () => {
  mockGetReviews.mockResolvedValueOnce(page({ reviews: [review("r1")], hasMore: true, total: 2 }));
  let release: (value: PagedReviewResponse) => void = () => {};
  mockGetReviews.mockReturnValueOnce(new Promise<PagedReviewResponse>((resolve) => (release = resolve)));

  await show();
  fireEvent.press(screen.getByText("Ladda fler"));
  await flushUntil(() => screen.queryByText("Laddar fler..."));

  expect(screen.getByText("Laddar fler...")).toBeTruthy();
  fireEvent.press(screen.getByText("Laddar fler..."));
  expect(mockGetReviews).toHaveBeenCalledTimes(2);

  release(page({ reviews: [review("r2")], hasMore: false, page: 1, total: 2 }));
  await flushUntil(() => screen.queryByText("Laddar fler...") === null);
});

it("shows the error view rather than an empty section when the reviews fail to load", async () => {
  mockGetReviews.mockRejectedValue(new Error("nätverket"));

  await show();

  expect(screen.getByText("Något gick fel")).toBeTruthy();
  expect(screen.queryByText("Recensioner")).toBeNull();
});

it("hides the write-review icon once the user has reviewed this trail", async () => {
  mockHasReviewed = true;

  await show();

  expect(screen.queryByTestId("icon-create-outline")).toBeNull();
});

it("asks an anonymous visitor to log in instead of opening the form", async () => {
  mockIsAuthenticated = false;

  await show();
  fireEvent.press(screen.getByTestId("icon-create-outline"));
  await settle();

  expect(screen.getByText("Du behöver vara inloggad för att skriva en recension.")).toBeTruthy();
  expect(screen.queryByTestId("add-review-modal")).toBeNull();
});

it("opens the form on the trail being viewed", async () => {
  await show();
  fireEvent.press(screen.getByTestId("icon-create-outline"));
  await settle();

  expect(screen.getByTestId("add-review-modal")).toHaveTextContent(`${TRAIL_ID}|Kvarnstigen|4.2`);
  expect(screen.queryByText("Du behöver vara inloggad för att skriva en recension.")).toBeNull();
});

it("keeps the reviews on a rounded, padded surface in the theme's surface colour", async () => {
  await show();

  expect(screen.getByTestId("reviews-surface")).toHaveStyle({
    borderRadius: 5,
    padding: 25,
    gap: 10,
    backgroundColor: AppDefaultTheme.colors.surface,
  });
});

it("draws the surface in the dark theme's colour too", async () => {
  await show(AppDarkTheme);

  expect(screen.getByTestId("reviews-surface")).toHaveStyle({ backgroundColor: AppDarkTheme.colors.surface });
});
