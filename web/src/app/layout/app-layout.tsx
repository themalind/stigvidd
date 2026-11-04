// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import Header from "./header";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Outlet, useLocation } from "react-router";
import { QueryBoundary } from "@/components/query-boundary";

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <QueryBoundary resetKeys={[pathname]}>
          <Outlet />
        </QueryBoundary>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
