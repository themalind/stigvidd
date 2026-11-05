// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getAdminDashboardGetDashboardSuspenseQueryOptions } from "@/api/generated/admin-dashboard/admin-dashboard";
import type { AdminDashboardReviewResponse } from "@/api/generated/model";

export type DashboardReview = AdminDashboardReviewResponse;

export const dashboardQueryOptions = () => getAdminDashboardGetDashboardSuspenseQueryOptions();
