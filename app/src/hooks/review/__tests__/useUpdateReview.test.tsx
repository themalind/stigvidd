// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { Review, UpdateReviewRequest } from "@/data/types";
import { useUpdateReview } from "@/hooks/review/useUpdateReview";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockUpdateReview = jest.fn();

jest.mock("@/api/reviews", () => ({
  updateReview: (...args: unknown[]) => mockUpdateReview(...args),
}));

const TRAIL = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";
const TRAIL_QUERY = ["trail", TRAIL];
const REVIEWS_QUERY = ["reviews", TRAIL, "me"];
const OTHER_TRAIL_REVIEWS_QUERY = ["reviews", "another-trail"];

const REQUEST: UpdateReviewRequest = {
  reviewIdentifier: "r1",
  review: "Blöt efter regnet",
  rating: 2,
  removedImageIdentifiers: ["img-1"],
  newImageUris: ["file://ny.jpg"],
};

const SAVED: Review = {
  identifier: "r1",
  trailReview: "Blöt efter regnet",
  rating: 2,
  userName: "Alva",
  createdAt: "2026-05-01T10:00:00Z",
  editedAt: "2026-11-25T10:00:00Z",
  userIdentifier: "me",
  trailIdentifier: TRAIL,
};

type Mutation = ReturnType<typeof useUpdateReview>;

async function render() {
  const onSuccess = jest.fn();
  let hook!: Mutation;
  function Probe() {
    hook = useUpdateReview(onSuccess);
    return null;
  }

  const rendered = await renderWithProviders(<Probe />);
  for (const key of [TRAIL_QUERY, REVIEWS_QUERY, OTHER_TRAIL_REVIEWS_QUERY]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, []);
  }

  return {
    ...rendered,
    onSuccess,
    run: async () => {
      await act(() => hook.mutate(REQUEST));
      await flushUntil(() => hook.isError || hook.isSuccess);
    },
    invalidated: (key: unknown[]) => rendered.queryClient.getQueryState(key)?.isInvalidated === true,
  };
}

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateReview.mockResolvedValue(SAVED);
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("useUpdateReview", () => {
  it("sends the edit it was given", async () => {
    const { run } = await render();
    await run();

    expect(mockUpdateReview).toHaveBeenCalledWith(REQUEST);
  });

  describe("when the edit is saved", () => {
    it("refreshes the trail's rating and its reviews, and no other trail's", async () => {
      const { run, invalidated } = await render();
      await run();

      expect(invalidated(TRAIL_QUERY)).toBe(true);
      expect(invalidated(REVIEWS_QUERY)).toBe(true);
      expect(invalidated(OTHER_TRAIL_REVIEWS_QUERY)).toBe(false);
    });

    it("confirms the review was updated", async () => {
      const { run, store } = await render();
      await run();

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "success",
        message: "Recensionen har uppdaterats",
      });
    });

    it("tells the caller to close the form", async () => {
      const { run, onSuccess } = await render();
      await run();

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the request throws", () => {
    beforeEach(() => {
      mockUpdateReview.mockRejectedValue(new Error("500"));
    });

    it("reports the failure", async () => {
      const { run, store } = await render();
      await run();

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte spara recensionen",
      });
    });

    it("leaves the form open and the caches alone", async () => {
      const { run, onSuccess, invalidated } = await render();
      await run();

      expect(onSuccess).not.toHaveBeenCalled();
      expect(invalidated(REVIEWS_QUERY)).toBe(false);
    });
  });
});
