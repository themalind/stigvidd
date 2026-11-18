// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { useAuth } from "@/components/auth/auth-provider";
import { stigviddUserAtom } from "@/atoms/user-atoms";
import { useAtomValue } from "jotai";

export type WriteBlockedReason = "unauthenticated" | "banned" | null;

// keep-comment: a ban leaves reading alone; the server refuses the write anyway, this names the reason
export function useCanWrite(): { canWrite: boolean; reason: WriteBlockedReason } {
  const { isAuthenticated } = useAuth();
  const { data: user } = useAtomValue(stigviddUserAtom);

  if (!isAuthenticated) {
    return { canWrite: false, reason: "unauthenticated" };
  }

  // keep-comment: a loading profile reads as allowed
  if (user?.bannedAt) {
    return { canWrite: false, reason: "banned" };
  }

  return { canWrite: true, reason: null };
}
