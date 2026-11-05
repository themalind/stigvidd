// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminGetTransferInfoSuspenseQueryOptions } from "@/api/generated/admin/admin";
import { exportData, importData } from "./admin";

export const transferInfoQueryOptions = () =>
  getAdminGetTransferInfoSuspenseQueryOptions({ query: { staleTime: Infinity } });

export function useExportData() {
  return useMutation({ mutationFn: (options: { anonymize: boolean }) => exportData(options) });
}

export function useImportData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => importData(file),
    // keep-comment: an import replaces every table, so no cached query is current any more
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
