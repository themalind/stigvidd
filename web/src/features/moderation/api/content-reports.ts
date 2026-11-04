// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminContentReportsDecide,
  getAdminContentReportsGetCountsQueryKey,
  getAdminContentReportsGetCountsSuspenseQueryOptions,
  getAdminContentReportsGetReportsQueryKey,
  getAdminContentReportsGetReportsSuspenseQueryOptions,
  getAdminContentReportsGetReportSuspenseQueryOptions,
} from "@/api/generated/admin-content-reports/admin-content-reports";

export const REPORTS_PAGE_SIZE = 25;

export interface QueueFilters {
  status?: string;
  contentType?: string;
  hideOutcome?: string;
  page: number;
}

export type Decision = "Dismiss" | "Uphold";

export const reportsQueryOptions = ({ page, ...filters }: QueueFilters) =>
  getAdminContentReportsGetReportsSuspenseQueryOptions({ ...filters, page, pageSize: REPORTS_PAGE_SIZE });

export const reportQueryOptions = (identifier: string) =>
  getAdminContentReportsGetReportSuspenseQueryOptions(identifier);

export const reportCountsQueryOptions = () => getAdminContentReportsGetCountsSuspenseQueryOptions();

// keep-comment: Dismiss puts the content back; Uphold deletes it permanently and records a strike
export function useDecideReport(identifier: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ decision, note }: { decision: Decision; note?: string }) =>
      adminContentReportsDecide(identifier, { decision, decisionNote: note }),
    onSuccess: (updated, { decision }) => {
      queryClient.setQueryData(reportQueryOptions(identifier).queryKey, updated);
      toast.success(
        decision === "Uphold" ? "The content was removed and a strike recorded." : "The content is visible again.",
      );
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: getAdminContentReportsGetReportsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getAdminContentReportsGetCountsQueryKey() }),
      ]);
    },
  });
}
