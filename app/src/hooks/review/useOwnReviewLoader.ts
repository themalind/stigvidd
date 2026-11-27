// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isApiStatus } from "@/api/core/api-error";
import { getOwnReview, hasReviewedTrail } from "@/api/reviews";
import { showErrorAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import { Review } from "@/data/types";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invalidateTrailReviews } from "./review-queries";

// keep-comment: "none" = the cached has-reviewed answer was stale; "unavailable" = a snackbar already said why
export type OwnReview = { kind: "found"; review: Review } | { kind: "none" } | { kind: "unavailable" };

// keep-comment: fetched fresh on each open, so an edit never starts from a review changed elsewhere
export function useOwnReviewLoader(trailIdentifier: string) {
  const { t } = useTranslation();
  const setWarning = useSetAtom(showWarningAtom);
  const setError = useSetAtom(showErrorAtom);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const load = async (): Promise<OwnReview> => {
    setIsLoading(true);
    try {
      return { kind: "found", review: await getOwnReview(trailIdentifier) };
    } catch (error) {
      if (!isApiStatus(error, 404)) {
        setError(t("review.loadOwnError"));
        return { kind: "unavailable" };
      }
      return await resolveMissingReview();
    } finally {
      setIsLoading(false);
    }
  };

  // keep-comment: a review hidden by moderation still counts as reviewed but is not handed out
  const resolveMissingReview = async (): Promise<OwnReview> => {
    try {
      if (await hasReviewedTrail(trailIdentifier)) {
        setWarning(t("review.alreadyReviewed"));
        return { kind: "unavailable" };
      }
    } catch {
      setError(t("review.loadOwnError"));
      return { kind: "unavailable" };
    }
    invalidateTrailReviews(queryClient, trailIdentifier);
    return { kind: "none" };
  };

  return { load, isLoading };
}
