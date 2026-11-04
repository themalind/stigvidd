// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminMailOutboxCancel,
  adminMailOutboxPurge,
  adminMailOutboxRetry,
  getAdminMailOutboxGetAllQueryKey,
  getAdminMailOutboxGetAllSuspenseQueryOptions,
  getAdminMailOutboxGetBodyQueryOptions,
  getAdminMailOutboxGetByIdentifierQueryKey,
  getAdminMailOutboxGetByIdentifierSuspenseQueryOptions,
  getAdminMailOutboxGetCountsQueryKey,
  getAdminMailOutboxGetCountsSuspenseQueryOptions,
} from "@/api/generated/admin-mail-outbox/admin-mail-outbox";

export interface OutboxFilters {
  status?: string;
  recipient?: string;
  page: number;
}

export const OUTBOX_PAGE_SIZE = 25;

export const outboxMailsQueryOptions = ({ status, recipient, page }: OutboxFilters) =>
  getAdminMailOutboxGetAllSuspenseQueryOptions({ status, recipient, page, pageSize: OUTBOX_PAGE_SIZE });

export const outboxMailQueryOptions = (identifier: string) =>
  getAdminMailOutboxGetByIdentifierSuspenseQueryOptions(identifier, { query: { staleTime: 0 } });

export const outboxCountsQueryOptions = () => getAdminMailOutboxGetCountsSuspenseQueryOptions();

// keep-comment: the API logs every body read, so it is fetched only on reveal, never refetched and never cached
export function useOutboxMailBody(identifier: string, revealed: boolean) {
  return useQuery({
    ...getAdminMailOutboxGetBodyQueryOptions(identifier),
    enabled: revealed,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
}

// keep-comment: exact keys, not a URL-prefix match, which would also refetch (and log) an open body
function useInvalidateOutbox() {
  const queryClient = useQueryClient();

  return (identifier?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getAdminMailOutboxGetAllQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getAdminMailOutboxGetCountsQueryKey() }),
      identifier && queryClient.invalidateQueries({ queryKey: getAdminMailOutboxGetByIdentifierQueryKey(identifier) }),
    ]);
}

export function useRetryOutboxMail() {
  const invalidate = useInvalidateOutbox();

  return useMutation({
    mutationFn: (identifier: string) => adminMailOutboxRetry(identifier),
    onSuccess: (_, identifier) => invalidate(identifier),
    meta: { successMessage: "Mail queued again." },
  });
}

export function useCancelOutboxMail() {
  const invalidate = useInvalidateOutbox();

  return useMutation({
    mutationFn: (identifier: string) => adminMailOutboxCancel(identifier),
    onSuccess: (_, identifier) => invalidate(identifier),
    meta: { successMessage: "Mail cancelled." },
  });
}

// keep-comment: deletes only SENT mail older than the cutoff; the API refuses it without confirm
export function usePurgeOutbox() {
  const invalidate = useInvalidateOutbox();

  return useMutation({
    mutationFn: (olderThanDays: number) => adminMailOutboxPurge({ olderThanDays, confirm: true }),
    onSuccess: ({ deleted }) => {
      toast.success(`${deleted} sent mail${deleted === 1 ? "" : "s"} deleted.`);
      return invalidate();
    },
  });
}
