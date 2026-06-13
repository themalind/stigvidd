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
        setSuccessMessage(t("review.deleted"));
      } else {
        setError(t("review.deleteError"));
      }
    },
  });
}
