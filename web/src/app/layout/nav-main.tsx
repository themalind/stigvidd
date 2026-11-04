// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router";
import { pages } from "../pages";

export default function NavMain() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {pages.map(
            ({ path, title, icon: Icon }) =>
              Icon && (
                <SidebarMenuItem key={path}>
                  <SidebarMenuButton asChild>
                    <NavLink to={path}>
                      <Icon />
                      <span>{title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
