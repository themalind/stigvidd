// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { snackbarAtom } from "@/atoms/snackbar-atoms";
import { useCreateReview } from "@/hooks/review/useCreateReview";
import { flushUntil } from "@/test/flush";
import { renderWithProviders } from "@/test/render";
import { act } from "@testing-library/react-native";

const mockCreateReview = jest.fn();

jest.mock("@/api/reviews", () => ({
  createReview: (...args: unknown[]) => mockCreateReview(...args),
}));

const TRAIL = "0a5f0f5e-1f65-4a52-9a2e-1e35a1c9c7b1";
const TRAIL_QUERY = ["trail", TRAIL];
const REVIEWS_QUERY = ["reviews", TRAIL];
const REVIEW_EXISTS_QUERY = ["review-exists", TRAIL, "me"];

type Mutation = ReturnType<typeof useCreateReview>;

function render() {
  const onSuccess = jest.fn();
  let hook!: Mutation;
  function Probe() {
    hook = useCreateReview(onSuccess);
    return null;
  }

  const rendered = renderWithProviders(<Probe />);
  for (const key of [TRAIL_QUERY, REVIEWS_QUERY, REVIEW_EXISTS_QUERY]) {
    rendered.queryClient.setQueryDefaults(key, { gcTime: Infinity });
    rendered.queryClient.setQueryData(key, []);
  }

  return {
    ...rendered,
    onSuccess,
    run: async (variables = { trailIdentifier: TRAIL, review: "Fin led", rating: 4, imageUris: [] as string[] }) => {
      act(() => hook.mutate(variables));
      await flushUntil(() => hook.isError || hook.isSuccess);
    },
    invalidated: (key: unknown[]) => rendered.queryClient.getQueryState(key)?.isInvalidated === true,
  };
}

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateReview.mockResolvedValue({ success: true });
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("useCreateReview", () => {
  it("posts the review it was given", async () => {
    const { run } = render();
    await run({ trailIdentifier: TRAIL, review: "Fin led", rating: 4, imageUris: ["file://a"] });

    expect(mockCreateReview).toHaveBeenCalledWith({
      trailIdentifier: TRAIL,
      review: "Fin led",
      rating: 4,
      imageUris: ["file://a"],
    });
  });

  describe("when the review is saved", () => {
    // The trail carries the rating average, the list carries the review, and review-exists
    // decides whether the rate button is still offered.
    it("refreshes the trail, its reviews and the has-reviewed answer", async () => {
      const { run, invalidated } = render();
      await run();

      expect(invalidated(TRAIL_QUERY)).toBe(true);
      expect(invalidated(REVIEWS_QUERY)).toBe(true);
      expect(invalidated(REVIEW_EXISTS_QUERY)).toBe(true);
    });

    it("confirms the review was added", async () => {
      const { run, store } = render();
      await run();

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "success",
        message: "Recensionen har lagts till",
      });
    });

    it("tells the caller to close the form", async () => {
      const { run, onSuccess } = render();
      await run();

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the server answers success: false", () => {
    beforeEach(() => {
      mockCreateReview.mockResolvedValue({ success: false });
    });

    it("reports the failure", async () => {
      const { run, store } = render();
      await run();

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte spara recensionen",
      });
    });

    it("leaves the form open and the caches alone", async () => {
      const { run, onSuccess, invalidated } = render();
      await run();

      expect(onSuccess).not.toHaveBeenCalled();
      expect(invalidated(REVIEWS_QUERY)).toBe(false);
    });
  });

  describe("when the request throws", () => {
    beforeEach(() => {
      mockCreateReview.mockRejectedValue(new Error("500"));
    });

    it("reports the failure", async () => {
      const { run, store } = render();
      await run();

      expect(store.get(snackbarAtom)).toMatchObject({
        visible: true,
        type: "error",
        message: "Kunde inte spara recensionen",
      });
    });

    it("leaves the form open", async () => {
      const { run, onSuccess } = render();
      await run();

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
