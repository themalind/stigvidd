import { acceptSharedHike, rejectSharedHike } from "@/api/shared-hikes";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

export function useSharedHikeMutations() {
  const queryClient = useQueryClient();
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const setErrorMsg = useSetAtom(showErrorAtom);
  const { t } = useTranslation();

  const acceptMutation = useMutation({
    mutationFn: (hikeIdentifier: string) => acceptSharedHike(hikeIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-hikes", "incoming"] });
      queryClient.invalidateQueries({ queryKey: ["shared-hikes"] });
      setSuccessMsg(t("hike.hikeAdded"));
    },
    onError: () => {
      setErrorMsg(t("friends.acceptError"));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (hikeIdentifier: string) => rejectSharedHike(hikeIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-hikes", "incoming"] });
      setSuccessMsg(t("hike.incomingRejected"));
    },
    onError: () => {
      setErrorMsg(t("friends.rejectError"));
    },
  });

  return { acceptMutation, rejectMutation };
}
