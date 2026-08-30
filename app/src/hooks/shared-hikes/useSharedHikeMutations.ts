// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

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
