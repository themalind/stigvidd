// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { pages } from "../pages";
import { buildNav, isUnder, type NavGroupItem, type NavPage } from "./nav-items";

const nav = buildNav(pages);

function NavPageItem({ page: { path, title, icon: Icon } }: { page: NavPage }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={title}>
        <NavLink to={path}>
          <Icon />
          <span>{title}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroupEntry({ item: { group, pages: children } }: { item: NavGroupItem }) {
  const { pathname } = useLocation();
  const { state, isMobile } = useSidebar();
  const active = children.some((child) => isUnder(pathname, child.path));
  const [expanded, setExpanded] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  const Icon = group.icon;
  const first = children[0];

  // keep-comment: opens on arriving at one of its pages, then stays wherever the admin leaves it; react.dev "adjusting some state when a prop changes"
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setExpanded(true);
  }

  // keep-comment: the mobile sheet always shows labels, so it keeps the full group even when the desktop sidebar is collapsed
  if (state === "collapsed" && !isMobile && first) {
    return <NavPageItem page={{ ...first, title: group.title, icon: Icon }} />;
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton aria-expanded={expanded} onClick={() => setExpanded((was) => !was)}>
        <Icon />
        <span>{group.title}</span>
        <ChevronRight className={cn("ml-auto transition-transform", expanded && "rotate-90")} aria-hidden />
      </SidebarMenuButton>
      {expanded && (
        <SidebarMenuSub>
          {children.map(({ path, title, icon: ChildIcon }) => (
            <SidebarMenuSubItem key={path}>
              <SidebarMenuSubButton asChild isActive={isUnder(pathname, path)}>
                <NavLink to={path}>
                  <ChildIcon />
                  <span>{title}</span>
                </NavLink>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export default function NavMain() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {nav.map((item) =>
            item.kind === "page" ? (
              <NavPageItem key={item.path} page={item} />
            ) : (
              <NavGroupEntry key={item.group.title} item={item} />
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
