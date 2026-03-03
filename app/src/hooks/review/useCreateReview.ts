import { createReview } from "@/api/reviews";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

export function useCreateReview(onSuccess: () => void) {
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
        setSuccess("Recensionen har lagts till");
        onSuccess();
      } else {
        console.error("Error creating review");
        setError("Kunde inte spara recensionen");
      }
    },
    onError: (error) => {
      console.error("Error creating review: ", error);
      setError("Kunde inte spara recensionen");
    },
  });
}
