// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { deleteReview } from "@/api/reviews";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

export function useDeleteReview() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setSuccessMessage = useSetAtom(showSuccessAtom);
  const setError = useSetAtom(showErrorAtom);

  return useMutation({
    mutationFn: ({ reviewIdentifier }: { reviewIdentifier: string; trailIdentifier: string }) =>
      deleteReview(reviewIdentifier),
    onSuccess: (result, { trailIdentifier }) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["trail", trailIdentifier] });
        queryClient.invalidateQueries({ queryKey: ["reviews", trailIdentifier] });
        // Brings the add option back
        queryClient.invalidateQueries({ queryKey: ["review-exists", trailIdentifier] });
        setSuccessMessage(t("review.deleted"));
      } else {
        setError(t("review.deleteError"));
      }
    },
  });
}
