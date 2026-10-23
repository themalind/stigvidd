// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import TrailContributionBar from "@/components/trail/trail-contribution-bar";
import { APP_THEMES } from "@/constants/theme";
import { flushUntil, settle } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { fireEvent, screen } from "@testing-library/react-native";

const mockGetLike = jest.fn();
const mockLike = jest.fn();
const mockUnlike = jest.fn();
jest.mock("@/api/trails", () => ({
  getTrailLike: (...args: unknown[]) => mockGetLike(...args),
  likeTrail: (...args: unknown[]) => mockLike(...args),
  unlikeTrail: (...args: unknown[]) => mockUnlike(...args),
}));

let mockIsAuthenticated = true;
let mockUserId = "user-a";
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? { id: mockUserId, email: "", username: "" } : null,
  }),
}));

const contribution = { submitterNickName: "Vandrarvennen", publishedAt: "2026-09-02T10:00:00Z", likeCount: 234 };

function count() {
  return screen.getByTestId("trail-like-count").props.children;
}

function pressable() {
  return screen.getByTestId("trail-like").props.accessibilityState?.disabled === false;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthenticated = true;
  mockUserId = "user-a";
  mockGetLike.mockResolvedValue({ likeCount: 234, likedByMe: false });
  mockLike.mockResolvedValue({ likeCount: 235, likedByMe: true });
  mockUnlike.mockResolvedValue({ likeCount: 234, likedByMe: false });
});

it("credits the submitter by nickname and shows the count", async () => {
  renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />);
  await settle();

  expect(screen.getByText("Delad av Vandrarvennen")).toBeTruthy();
  expect(count()).toBe(234);
});

it("leaves out the credit when the submitter is not named", async () => {
  renderWithProviders(
    <TrailContributionBar trailIdentifier="t1" contribution={{ ...contribution, submitterNickName: null }} />,
  );
  await settle();

  expect(screen.queryByText(/Delad av/)).toBeNull();
  expect(screen.getByText("Användarpromenad")).toBeTruthy();
});

it("likes and then unlikes", async () => {
  renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />);
  await flushUntil(pressable);

  fireEvent.press(screen.getByTestId("trail-like"));
  await flushUntil(() => mockLike.mock.calls.length > 0 && count() === 235);

  expect(mockLike).toHaveBeenCalledWith("t1");
  expect(count()).toBe(235);

  fireEvent.press(screen.getByTestId("trail-like"));
  await flushUntil(() => mockUnlike.mock.calls.length > 0 && count() === 234);

  expect(mockUnlike).toHaveBeenCalledWith("t1");
  expect(count()).toBe(234);
});

it("cannot be pressed before the user's own like has loaded", async () => {
  mockGetLike.mockReturnValue(new Promise(() => {}));
  renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />);
  await settle();

  fireEvent.press(screen.getByTestId("trail-like"));
  await settle();

  expect(mockLike).not.toHaveBeenCalled();
  expect(mockUnlike).not.toHaveBeenCalled();
});

it("unlikes a trail the user had already liked", async () => {
  mockGetLike.mockResolvedValue({ likeCount: 235, likedByMe: true });
  renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />);
  await flushUntil(pressable);

  fireEvent.press(screen.getByTestId("trail-like"));
  await flushUntil(() => mockUnlike.mock.calls.length > 0);

  expect(mockUnlike).toHaveBeenCalledWith("t1");
  expect(mockLike).not.toHaveBeenCalled();
});

describe.each(APP_THEMES)("in the $id theme", ({ theme }) => {
  it("sits on the theme's surface with a primary edge, like the obstacle warning", async () => {
    renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />, { theme });
    await settle();

    expect(screen.getByTestId("trail-contribution")).toHaveStyle({
      backgroundColor: theme.colors.surface,
      borderLeftColor: theme.colors.primary,
      borderLeftWidth: 4,
    });
  });

  it("draws the like without a frame in the theme's primary colour, unfilled once liked", async () => {
    renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />, { theme });
    await flushUntil(pressable);

    const ink = theme.colors.primary;
    expect(screen.getByTestId("trail-like")).not.toHaveStyle({ borderWidth: 1 });
    expect(screen.getByTestId("trail-like-count")).toHaveStyle({ color: ink });

    fireEvent.press(screen.getByTestId("trail-like"));
    await flushUntil(() => count() === 235);

    expect(screen.getByTestId("trail-like").props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId("trail-like")).not.toHaveStyle({ backgroundColor: ink });
    expect(screen.getByTestId("trail-like-count")).toHaveStyle({ color: ink });
  });
});

it("asks again for another user rather than showing the previous user's like", async () => {
  mockGetLike.mockResolvedValue({ likeCount: 235, likedByMe: true });
  const { rerender } = renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />);
  await flushUntil(() => screen.getByTestId("trail-like").props.accessibilityState?.selected === true);

  mockUserId = "user-b";
  mockGetLike.mockResolvedValue({ likeCount: 235, likedByMe: false });
  rerender(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />);
  await flushUntil(() => mockGetLike.mock.calls.length > 1);
  await settle();

  expect(screen.getByTestId("trail-like").props.accessibilityState?.selected).toBe(false);
});

it("rolls back and reports when the like fails", async () => {
  mockLike.mockRejectedValue(new Error("500"));
  const { store } = renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />);
  await flushUntil(pressable);

  fireEvent.press(screen.getByTestId("trail-like"));
  await flushUntil(() => store.get(snackbarAtom).visible);

  expect(count()).toBe(234);
  expect(store.get(snackbarAtom)).toMatchObject({ type: "error" });
});

it("asks a signed-out user to sign in instead of liking", async () => {
  mockIsAuthenticated = false;
  renderWithProviders(<TrailContributionBar trailIdentifier="t1" contribution={contribution} />);
  await settle();

  fireEvent.press(screen.getByTestId("trail-like"));
  await settle();

  expect(screen.getByText("Du behöver vara inloggad för att gilla en promenad.")).toBeTruthy();
  expect(mockGetLike).not.toHaveBeenCalled();
  expect(mockLike).not.toHaveBeenCalled();
  expect(count()).toBe(234);
});
