import { createReview } from "@/api/reviews";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

export function useCreateReview(onSuccess: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setSuccess = useSetAtom(showSuccessAtom);
  const setError = useSetAtom(showErrorAtom);

  return useMutation({
    mutationFn: async ({
      trailIdentifier,
      review,
      rating,
      imageUris,
    }: {
      trailIdentifier: string;
      review: string;
      rating: number;
      imageUris: string[];
    }) => {
      return await createReview({
        trailIdentifier,
        review,
        rating,
        imageUris,
      });
    },
    onSuccess: (result, variables) => {
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: ["trail", variables.trailIdentifier],
        });
        queryClient.invalidateQueries({
          queryKey: ["reviews", variables.trailIdentifier],
        });
        setSuccess(t("review.added"));
        onSuccess();
      } else {
        console.error("Error creating review");
        setError(t("review.saveError"));
      }
    },
    onError: (error) => {
      console.error("Error creating review: ", error);
      setError(t("review.saveError"));
    },
  });
}
