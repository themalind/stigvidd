// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { apiErrorCode, problemStrings } from "@/api/api-error";
import {
  cancelEvent,
  deleteEvent,
  getEventParticipants,
  inviteToEvent,
  removeEventParticipant,
  revokeEventInvitation,
  setEventParticipantRole,
} from "@/api/events";
import { userAtom } from "@/atoms/auth-atoms";
import { showSuccessAtom, showWarningAtom } from "@/atoms/snackbar-atoms";
import { EVENTS_STALE_TIME } from "@/constants/cache";
import { EventRole } from "@/data/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useEventErrorHandler } from "./useEventErrorHandler";

export function useEventParticipants(identifier: string | undefined) {
  const user = useAtomValue(userAtom);
  return useQuery({
    queryKey: ["events", "participants", identifier, user?.id],
    queryFn: () => {
      if (!identifier) throw new Error("expected an event identifier");
      return getEventParticipants(identifier);
    },
    enabled: !!user?.id && !!identifier,
    staleTime: EVENTS_STALE_TIME,
  });
}

export function useEventManageMutations(identifier: string) {
  const { t } = useTranslation();
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const setWarningMsg = useSetAtom(showWarningAtom);
  const { refresh, onEventError } = useEventErrorHandler();
  const queryClient = useQueryClient();
  const [unknownNickNames, setUnknownNickNames] = useState<string[]>([]);

  // A role, invite or revoke changes only who is in this event, not the cards in any list. keep-comment: why not refresh()
  const refreshParticipants = () => {
    void queryClient.invalidateQueries({ queryKey: ["events", "participants", identifier] });
    void queryClient.invalidateQueries({ queryKey: ["events", "detail", identifier] });
  };

  const cancelMutation = useMutation({
    mutationFn: () => cancelEvent(identifier),
    onSuccess: () => {
      refresh();
      setSuccessMsg(t("events.cancelledByYou"));
    },
    onError: (error) => onEventError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(identifier),
    onSuccess: () => {
      refresh(identifier);
      setSuccessMsg(t("events.deleted"));
    },
    onError: (error) => onEventError(error),
  });

  const setRoleMutation = useMutation({
    mutationFn: ({ userIdentifier, role }: { userIdentifier: string; role: Exclude<EventRole, "Organizer"> }) =>
      setEventParticipantRole(identifier, userIdentifier, role),
    onSuccess: refreshParticipants,
    onError: (error) => onEventError(error),
  });

  const removeMutation = useMutation({
    mutationFn: (userIdentifier: string) => removeEventParticipant(identifier, userIdentifier),
    onSuccess: () => refresh(),
    onError: (error) => onEventError(error),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteeIdentifier: string) => revokeEventInvitation(identifier, inviteeIdentifier),
    onSuccess: refreshParticipants,
    onError: (error) => onEventError(error),
  });

  const inviteMutation = useMutation({
    mutationFn: (nickNames: string[]) => inviteToEvent(identifier, nickNames),
    onSuccess: (_data, nickNames) => {
      refreshParticipants();
      setSuccessMsg(t("events.invited", { count: nickNames.length }));
    },
    onError: (error) => {
      // Nothing was sent; the picker drops these and the rest can be sent again. keep-comment: the invite is all-or-nothing
      const unknown = apiErrorCode(error) === "unknown_nicknames" ? problemStrings(error, "nickNames") : [];
      if (unknown.length === 0) return onEventError(error);
      setUnknownNickNames(unknown);
      setWarningMsg(t("events.nickNamesGone", { nickNames: unknown.join(", ") }));
    },
  });

  return {
    cancelMutation,
    deleteMutation,
    setRoleMutation,
    removeMutation,
    revokeMutation,
    inviteMutation,
    unknownNickNames,
  };
}
