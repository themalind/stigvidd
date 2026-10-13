// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { isApiStatus } from "@/api/api-error";
import { acceptFriendRequest, rejectFriendRequest, removeFriend, sendFriendRequest } from "@/api/friends";
import { showErrorAtom, showSuccessAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

export function useFriendMutations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const setErrorMsg = useSetAtom(showErrorAtom);
  const setWarningMsg = useSetAtom(showWarningAtom);

  // 404: withdrawn, already answered or account deleted, so stale. keep-comment: three causes, one status
  const onGone = () => {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
    setWarningMsg(t("friends.requestGone"));
  };

  const acceptMutation = useMutation({
    mutationFn: (requesterIdentifier: string) => acceptFriendRequest(requesterIdentifier),
    onSuccess: () => {
      // Covers the incoming requests too, which are keyed under the same prefix.
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      setSuccessMsg(t("friends.requestAccepted"));
    },
    onError: (error) => {
      if (isApiStatus(error, 404)) return onGone();
      setErrorMsg(t("friends.acceptError"));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requesterIdentifier: string) => rejectFriendRequest(requesterIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "incoming"] });
      setSuccessMsg(t("friends.requestRejected"));
    },
    onError: (error) => {
      if (isApiStatus(error, 404)) {
        queryClient.invalidateQueries({ queryKey: ["friends"] });
        setSuccessMsg(t("friends.requestRejected"));
        return;
      }
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
    onError: (error) => {
      if (isApiStatus(error, 404)) return onGone();
      setErrorMsg(t("friends.removeError"));
    },
  });

  const withdrawRequestMutation = useMutation({
    mutationFn: (receiverIdentifier: string) => removeFriend(receiverIdentifier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "outgoing"] });
      setSuccessMsg(t("friends.requestWithdrawnByYou"));
    },
    onError: (error) => {
      if (isApiStatus(error, 404)) return onGone();
      setErrorMsg(t("friends.withdrawError"));
    },
  });

  return { acceptMutation, rejectMutation, sendRequestMutation, removeFriendMutation, withdrawRequestMutation };
}
