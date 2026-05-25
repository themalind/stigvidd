import { acceptFriendRequest, rejectFriendRequest, removeFriend, sendFriendRequest } from "@/api/friends";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

export function useFriendMutations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const setErrorMsg = useSetAtom(showErrorAtom);

  const acceptMutation = useMutation({
    mutationFn: (requesterIdentifier: string) => acceptFriendRequest(requesterIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "incoming"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setSuccessMsg(t("friends.requestAccepted"));
    },
    onError: () => {
      setErrorMsg(t("friends.acceptError"));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requesterIdentifier: string) => rejectFriendRequest(requesterIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "incoming"] });
      setSuccessMsg(t("friends.requestRejected"));
    },
    onError: () => {
      setErrorMsg(t("friends.rejectError"));
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: (receiverNickName: string) => sendFriendRequest(receiverNickName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "outgoing"] });
      setSuccessMsg(t("friends.requestSent"));
    },
    onError: () => {
      setErrorMsg(t("friends.sendError"));
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendIdentifier: string) => removeFriend(friendIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setSuccessMsg(t("friends.friendRemoved"));
    },
    onError: () => {
      setErrorMsg(t("friends.removeError"));
    },
  });

  return { acceptMutation, rejectMutation, sendRequestMutation, removeFriendMutation };
}
