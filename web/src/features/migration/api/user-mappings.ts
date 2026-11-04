// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminUserMappingsDeleteMapping,
  adminUserMappingsSaveMapping,
  getAdminUserMappingsGetMappingsQueryKey,
  getAdminUserMappingsGetMappingsSuspenseQueryOptions,
  getAdminUserMappingsSearchKeycloakUsersQueryOptions,
} from "@/api/generated/admin-user-mappings/admin-user-mappings";
import type { SaveUserMappingRequest } from "@/api/generated/model";

export const userMappingsQueryOptions = () => getAdminUserMappingsGetMappingsSuspenseQueryOptions();

export const keycloakUsersQueryOptions = (search: string) =>
  getAdminUserMappingsSearchKeycloakUsersQueryOptions({ search });

export function useSaveUserMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ packageUserId, request }: { packageUserId: number; request: SaveUserMappingRequest }) =>
      adminUserMappingsSaveMapping(packageUserId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminUserMappingsGetMappingsQueryKey() }),
    meta: { successMessage: "Mapping saved and applied." },
  });
}

export function useDeleteUserMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (packageUserId: number) => adminUserMappingsDeleteMapping(packageUserId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminUserMappingsGetMappingsQueryKey() }),
    meta: { successMessage: "Mapping removed." },
  });
}
