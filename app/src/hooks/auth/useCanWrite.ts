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

/**
 * Whether this user may add something other people will see. A ban leaves reading alone, so
 * the screens stay as they are and only the buttons that write consult this.
 *
 * The server refuses the write either way; this names which of the two reasons it is.
 */
export function useCanWrite(): { canWrite: boolean; reason: WriteBlockedReason } {
  const { isAuthenticated } = useAuth();
  const { data: user } = useAtomValue(stigviddUserAtom);

  if (!isAuthenticated) {
    return { canWrite: false, reason: "unauthenticated" };
  }

  // Undefined while the profile is still loading, which reads as allowed.
  if (user?.bannedAt) {
    return { canWrite: false, reason: "banned" };
  }

  return { canWrite: true, reason: null };
}
