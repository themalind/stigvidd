// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ApiError } from "@/api/api-error";
import { getStigViddUser } from "@/api/users";
import { userAtom } from "@/atoms/auth-atoms";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import AccountBannedDialog from "./account-banned-dialog";

export function BannedWriteDialog() {
  const queryClient = useQueryClient();
  const subjectId = useAtomValue(userAtom)?.id;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!subjectId) return;

    // keep-comment: 403 also means "not yours" on some routes, so only a re-read profile can say it is a ban.
    const confirmBan = () =>
      queryClient
        .fetchQuery({ queryKey: ["currentUser", subjectId], queryFn: getStigViddUser, staleTime: 0 })
        .then((user) => {
          if (user?.bannedAt) setVisible(true);
        })
        .catch(() => undefined);

    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "error") return;
      const { error } = event.action;
      if (error instanceof ApiError && error.status === 403) void confirmBan();
    });
  }, [queryClient, subjectId]);

  return <AccountBannedDialog visible={visible} onDismiss={() => setVisible(false)} />;
}
