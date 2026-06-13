import { acceptSharedHike, rejectSharedHike } from "@/api/shared-hikes";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

export function useSharedHikeMutations() {
  const queryClient = useQueryClient();
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const setErrorMsg = useSetAtom(showErrorAtom);

  const acceptMutation = useMutation({
    mutationFn: (hikeIdentifier: string) => acceptSharedHike(hikeIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-hikes", "incoming"] });
      queryClient.invalidateQueries({ queryKey: ["shared-hikes"] });
      setSuccessMsg("Promenaden tillagd!");
    },
    onError: () => {
      setErrorMsg("Kunde inte godkänna, försök igen senare!");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (hikeIdentifier: string) => rejectSharedHike(hikeIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-hikes", "incoming"] });
      setSuccessMsg("Promenaden har tagits bort");
    },
    onError: () => {
      setErrorMsg("Något gick fel, försök igen senare!");
    },
  });

  return { acceptMutation, rejectMutation };
}
