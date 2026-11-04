// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminContentReportsGetAuthorsQueryKey,
  getAdminContentReportsGetAuthorsSuspenseQueryOptions,
  getAdminContentReportsGetReportersSuspenseQueryOptions,
} from "@/api/generated/admin-content-reports/admin-content-reports";
import { adminUsersBanUser, adminUsersUnbanUser } from "@/api/generated/admin-users/admin-users";
import { displayName } from "@/utils/format";

export const PAGE_SIZE = 25;

export const reportersQueryOptions = (page: number) =>
  getAdminContentReportsGetReportersSuspenseQueryOptions({ page, pageSize: PAGE_SIZE });

export const authorsQueryOptions = (page: number) =>
  getAdminContentReportsGetAuthorsSuspenseQueryOptions({ page, pageSize: PAGE_SIZE });

export interface UserTarget {
  identifier: string;
  nickName?: string | null;
}

interface BanVariables {
  target: UserTarget;
  reason?: string;
}

function useInvalidateAuthors() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: getAdminContentReportsGetAuthorsQueryKey() });
}

// keep-comment: a ban is read-only; the account still signs in and reads, and stops being able to write
export function useBanUser() {
  const invalidateAuthors = useInvalidateAuthors();

  return useMutation({
    mutationFn: ({ target, reason }: BanVariables) => adminUsersBanUser(target.identifier, { reason }),
    onSuccess: (_, { target }) => {
      toast.success(`${displayName(target.nickName)} can no longer write in the app.`);
      return invalidateAuthors();
    },
  });
}

export function useUnbanUser() {
  const invalidateAuthors = useInvalidateAuthors();

  return useMutation({
    mutationFn: (target: UserTarget) => adminUsersUnbanUser(target.identifier),
    onSuccess: (_, target) => {
      toast.success(`${displayName(target.nickName)} can write again.`);
      return invalidateAuthors();
    },
  });
}
