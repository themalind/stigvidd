// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/core/api-error";
import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { Review } from "@/data/types";
import { OwnReview, useOwnReviewLoader } from "@/hooks/review/useOwnReviewLoader";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockGetOwnReview = jest.fn();
const mockHasReviewedTrail = jest.fn();

jest.mock("@/api/reviews", () => ({
  getOwnReview: (...args: unknown[]) => mockGetOwnReview(...args),
  hasReviewedTrail: (...args: unknown[]) => mockHasReviewedTrail(...args),
}));

const TRAIL = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";

const REVIEW: Review = {
  identifier: "r1",
  rating: 4,
  userName: "Alva",
  createdAt: "2026-05-01T10:00:00Z",
  userIdentifier: "me",
  trailIdentifier: TRAIL,
};

async function render() {
  const holder: { loader?: ReturnType<typeof useOwnReviewLoader> } = {};
  function Probe() {
    holder.loader = useOwnReviewLoader(TRAIL);
    return null;
  }
  const rendered = await renderWithProviders(<Probe />);
  const load = async () => {
    const { loader } = holder;
    if (!loader) throw new Error("expected loader");
    let result: OwnReview | undefined;
    await act(async () => {
      result = await loader.load();
    });
    return result;
  };
  return { ...rendered, load };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("returns the user's review for the trail", async () => {
  mockGetOwnReview.mockResolvedValue(REVIEW);
  const { load, store } = await render();

  expect(await load()).toEqual({ kind: "found", review: REVIEW });
  expect(mockGetOwnReview).toHaveBeenCalledWith(TRAIL);
  expect(store.get(snackbarAtom).visible).toBe(false);
});

it("says the trail is already rated when the review is hidden from them", async () => {
  mockGetOwnReview.mockRejectedValue(new ApiError("not found", 404));
  mockHasReviewedTrail.mockResolvedValue(true);
  const { load, store } = await render();

  expect(await load()).toEqual({ kind: "unavailable" });
  expect(mockHasReviewedTrail).toHaveBeenCalledWith(TRAIL);
  expect(store.get(snackbarAtom)).toMatchObject({
    visible: true,
    type: "warning",
    message: "Du har redan betygsatt den här leden.",
  });
});

it("reports no review and refreshes the cached answer when the review is gone", async () => {
  mockGetOwnReview.mockRejectedValue(new ApiError("not found", 404));
  mockHasReviewedTrail.mockResolvedValue(false);
  const { load, store, queryClient } = await render();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries");

  expect(await load()).toEqual({ kind: "none" });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["review-exists", TRAIL] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["reviews", TRAIL] });
  expect(store.get(snackbarAtom).visible).toBe(false);
});

it("reports an error when the recheck after a 404 fails", async () => {
  mockGetOwnReview.mockRejectedValue(new ApiError("not found", 404));
  mockHasReviewedTrail.mockRejectedValue(new TypeError("Network request failed"));
  const { load, store } = await render();

  expect(await load()).toEqual({ kind: "unavailable" });
  expect(store.get(snackbarAtom)).toMatchObject({ visible: true, type: "error" });
});

it("reports a failed fetch as an error, not as already rated", async () => {
  mockGetOwnReview.mockRejectedValue(new TypeError("Network request failed"));
  const { load, store } = await render();

  expect(await load()).toEqual({ kind: "unavailable" });
  expect(store.get(snackbarAtom)).toMatchObject({
    visible: true,
    type: "error",
    message: "Kunde inte hämta din recension. Försök igen.",
  });
});
