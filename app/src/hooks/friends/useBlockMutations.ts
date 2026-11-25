// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { blockUser, unblockUser } from "@/api/friends";
import { showErrorAtom, showSuccessAtom } from "@/atoms/snackbar-atoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

export function useBlockMutations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setSuccessMsg = useSetAtom(showSuccessAtom);
  const setErrorMsg = useSetAtom(showErrorAtom);

  // keep-comment: a block filters the blocker's own reads, so every list that can show the person is re-read
  const invalidateEverythingTheBlockTouches = () => {
    void queryClient.invalidateQueries({ queryKey: ["friends"] });
    void queryClient.invalidateQueries({ queryKey: ["blocks"] });
    void queryClient.invalidateQueries({ queryKey: ["reviews"] });
    void queryClient.invalidateQueries({ queryKey: ["obstacles"] });
    void queryClient.invalidateQueries({ queryKey: ["shared-hikes"] });
    void queryClient.invalidateQueries({ queryKey: ["users", "search"] });
  };

  const blockMutation = useMutation({
    mutationFn: (identifier: string) => blockUser(identifier),
    onSuccess: () => {
      invalidateEverythingTheBlockTouches();
      setSuccessMsg(t("friends.blocked"));
    },
    onError: () => {
      setErrorMsg(t("friends.blockError"));
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (identifier: string) => unblockUser(identifier),
    onSuccess: () => {
      invalidateEverythingTheBlockTouches();
      setSuccessMsg(t("friends.unblocked"));
    },
    onError: () => {
      setErrorMsg(t("friends.unblockError"));
    },
  });

  return { blockMutation, unblockMutation };
}
