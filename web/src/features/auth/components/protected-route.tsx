// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useAuth } from "@/features/auth/context/auth-context";
import { Navigate, Outlet } from "react-router";
import { FullPageLoading } from "@/components/loading-state";
import { paths } from "@/config/paths";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <FullPageLoading />;
  if (!isAuthenticated) return <Navigate to={paths.login} replace />;

  return <Outlet />;
}
