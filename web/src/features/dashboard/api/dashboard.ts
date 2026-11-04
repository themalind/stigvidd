// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { adminDashboardGetDashboard } from "@/api/generated/admin-dashboard/admin-dashboard";
import type { AdminDashboardResponse } from "@/api/generated/model";

export type Dashboard = AdminDashboardResponse;
export type DashboardReview = AdminDashboardResponse["latestReviews"][number];

export async function getDashboard(): Promise<Dashboard> {
  return adminDashboardGetDashboard();
}
