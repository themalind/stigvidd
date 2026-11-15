// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getAdminDashboardGetAttentionQueryKey,
  getAdminDashboardGetAttentionQueryOptions,
} from "@/api/generated/admin-dashboard/admin-dashboard";
import type { AdminAttentionResponse } from "@/api/generated/model";

export type Attention = AdminAttentionResponse;
export type AttentionKey = keyof Attention;

// keep-comment: polled, so work that arrives while the admin is on another page shows without a reload
const POLL_MS = 60_000;

export function useAttention() {
  return useQuery({
    ...getAdminDashboardGetAttentionQueryOptions(),
    refetchInterval: POLL_MS,
    meta: { errorMessage: "Could not count the work waiting for you." },
  });
}

// keep-comment: any saved decision can settle work an admin was waiting on, so the counts follow every success
export function recountAfterMutations(queryClient: QueryClient): () => void {
  return queryClient.getMutationCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "success") {
      void queryClient.invalidateQueries({ queryKey: getAdminDashboardGetAttentionQueryKey() });
    }
  });
}
