// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { useDeleteReview } from "@/hooks/review/useDeleteReview";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockDeleteReview = jest.fn();

jest.mock("@/api/reviews", () => ({
  deleteReview: (...args: unknown[]) => mockDeleteReview(...args),
}));

const TRAIL = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";
const REVIEW = "b7e1a3d2-8c44-4a1f-9f21-5c6d7e8f9a01";
const TRAIL_QUERY = ["trail", TRAIL];
const REVIEWS_QUERY = ["reviews", TRAIL];
const REVIEW_EXISTS_QUERY = ["review-exists", TRAIL, "me"];

type Mutation = ReturnType<typeof useDeleteReview>;

function render() {
  let hook!: Mutation;
  function Probe() {
    hook = useDeleteReview();
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  for (const key of [TRAIL_QUERY, REVIEWS_QUERY, REVIEW_EXISTS_QUERY]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, []);
  }

  return {
    ...rendered,
    run: async () => {
      act(() => hook.mutate({ reviewIdentifier: REVIEW, trailIdentifier: TRAIL }));
      await flushUntil(() => hook.isError || hook.isSuccess);
    },
    invalidated: (key: unknown[]) => rendered.queryClient.getQueryState(key)?.isInvalidated === true,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDeleteReview.mockResolvedValue({ success: true });
});

describe("useDeleteReview", () => {
  // The trail identifier is only there to say which caches to refresh.
  it("deletes by review identifier alone", async () => {
    const { run } = render();
    await run();

    expect(mockDeleteReview).toHaveBeenCalledWith(REVIEW);
  });

  describe("when the review is deleted", () => {
    it("refreshes the trail, its reviews and the has-reviewed answer", async () => {
      const { run, invalidated } = render();
      await run();

      expect(invalidated(TRAIL_QUERY)).toBe(true);
      expect(invalidated(REVIEWS_QUERY)).toBe(true);
      expect(invalidated(REVIEW_EXISTS_QUERY)).toBe(true);
    });

    it("confirms the removal", async () => {
      const { run, store } = render();
      await run();

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "success",
        message: "Recensionen har tagits bort",
      });
    });
  });

  describe("when the server answers success: false", () => {
    beforeEach(() => {
      mockDeleteReview.mockResolvedValue({ success: false });
    });

    it("reports the failure", async () => {
      const { run, store } = render();
      await run();

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte ta bort recensionen",
      });
    });

    it("leaves the caches alone", async () => {
      const { run, invalidated } = render();
      await run();

      expect(invalidated(REVIEWS_QUERY)).toBe(false);
    });
  });

  describe("when the request throws", () => {
    beforeEach(() => {
      mockDeleteReview.mockRejectedValue(new Error("500"));
    });

    it("reports the failure", async () => {
      const { run, store } = render();
      await run();

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte ta bort recensionen",
      });
    });

    it("leaves the caches alone", async () => {
      const { run, invalidated } = render();
      await run();

      expect(invalidated(REVIEWS_QUERY)).toBe(false);
    });
  });
});
