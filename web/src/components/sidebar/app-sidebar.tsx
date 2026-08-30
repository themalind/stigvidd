// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Code2 } from "lucide-react";
import NavMain from "./nav-main";
import { NavUser } from "./nav-user";
import { NavLink } from "react-router";

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/" className="flex w-full items-center">
                <img src="/icon.png" className="h-6 aspect-square shrink-0" />
                <h1 className="text-xl cursor-default">Stigvidd</h1>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain />
      </SidebarContent>

      <SidebarFooter>
        {/* AGPL section 13: anyone interacting with this service over a network is
            entitled to its Corresponding Source, and the admin web is half of that
            service. This link is how the offer is made — it is an obligation of the
            licence, not a courtesy, so it stays visible rather than living in a
            settings page nobody opens. */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="sm"
              tooltip="Source code — AGPL-3.0-or-later"
            >
              <a
                href="https://github.com/themalind/stigvidd"
                target="_blank"
                rel="noreferrer"
              >
                <Code2 />
                <span>Source (AGPL-3.0)</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
