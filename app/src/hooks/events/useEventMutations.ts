// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import {
  acceptEventInvitation,
  declineEventInvitation,
  joinEvent,
  leaveEvent,
  markEventInterested,
  unmarkEventInterested,
} from "@/api/events";
import { showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { useEventErrorHandler } from "./useEventErrorHandler";

export function useEventMutations() {
  const { t } = useTranslation();
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const { refresh, onEventError } = useEventErrorHandler();

  const joinMutation = useMutation({
    mutationFn: (identifier: string) => joinEvent(identifier),
    onSuccess: () => {
      refresh();
      setSuccessMsg(t("events.joined"));
    },
    onError: (error) => onEventError(error, "join"),
  });

  const leaveMutation = useMutation({
    mutationFn: (identifier: string) => leaveEvent(identifier),
    onSuccess: () => {
      refresh();
      setSuccessMsg(t("events.left"));
    },
    onError: (error) => onEventError(error),
  });

  const interestedMutation = useMutation({
    mutationFn: ({ identifier, interested }: { identifier: string; interested: boolean }) =>
      interested ? markEventInterested(identifier) : unmarkEventInterested(identifier),
    onSuccess: refresh,
    onError: (error) => onEventError(error),
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: (identifier: string) => acceptEventInvitation(identifier),
    onSuccess: () => {
      refresh();
      setSuccessMsg(t("events.accepted"));
    },
    onError: (error) => onEventError(error),
  });

  const declineInvitationMutation = useMutation({
    mutationFn: (identifier: string) => declineEventInvitation(identifier),
    onSuccess: () => {
      refresh();
      setSuccessMsg(t("events.declined"));
    },
    onError: (error) => onEventError(error),
  });

  return {
    joinMutation,
    leaveMutation,
    interestedMutation,
    acceptInvitationMutation,
    declineInvitationMutation,
  };
}
