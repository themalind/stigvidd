// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { updateReview } from "@/api/reviews";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { UpdateReviewRequest } from "@/data/types";
import { logger } from "@/services/logger";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { invalidateTrailReviews } from "./review-queries";

export function useUpdateReview(onSuccess: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setSuccess = useSetAtom(showSuccessAtom);
  const setError = useSetAtom(showErrorAtom);

  return useMutation({
    mutationFn: (request: UpdateReviewRequest) => updateReview(request),
    onSuccess: (review) => {
      invalidateTrailReviews(queryClient, review.trailIdentifier);
      setSuccess(t("review.updated"));
      onSuccess();
    },
    onError: (error) => {
      logger.error("Update review failed", { error: String(error) });
      setError(t("review.saveError"));
    },
  });
}
