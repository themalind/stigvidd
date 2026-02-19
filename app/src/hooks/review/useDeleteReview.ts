import { deleteReview } from "@/api/review";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

export function useDeleteReview() {
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
        setSuccessMessage("Recensionen har tagits bort");
      } else {
        setError("Kunde inte ta bort recensionen.");
      }
    },
  });
}
