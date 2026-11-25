// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import type { Attention } from "@/api/attention";
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
import { NavBadge, NavInlineBadge } from "./nav-badge";
import { badgeCount, buildNav, isUnder, type NavGroupItem, type NavPage } from "./nav-items";

const nav = buildNav(pages);

interface ItemProps {
  // keep-comment: undefined while the counts load or after they failed; no badge shows then
  attention?: Attention;
}

function NavPageItem({ page, count }: { page: NavPage; count: number }) {
  const { path, title, icon: Icon } = page;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={count > 0 ? `${title} (${count})` : title}>
        <NavLink to={path}>
          <Icon />
          <span>{title}</span>
        </NavLink>
      </SidebarMenuButton>
      <NavBadge count={count} />
    </SidebarMenuItem>
  );
}

function NavGroupEntry({ item: { group, pages: children }, attention }: { item: NavGroupItem } & ItemProps) {
  const { pathname } = useLocation();
  const { state, isMobile } = useSidebar();
  const active = children.some((child) => isUnder(pathname, child.path));
  const [expanded, setExpanded] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  const Icon = group.icon;
  const first = children[0];
  const total = badgeCount(children, attention);

  // keep-comment: opens on arriving at one of its pages, then stays wherever the admin leaves it; react.dev "adjusting some state when a prop changes"
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setExpanded(true);
  }

  // keep-comment: the mobile sheet always shows labels, so it keeps the full group even when the desktop sidebar is collapsed
  if (state === "collapsed" && !isMobile && first) {
    return <NavPageItem page={{ ...first, title: group.title, icon: Icon }} count={total} />;
  }

  const showsTotal = !expanded && total > 0;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton aria-expanded={expanded} onClick={() => setExpanded((was) => !was)}>
        <Icon />
        <span className="truncate">{group.title}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {/* keep-comment: an open group shows each page's count instead, so the sum is not counted twice */}
          {showsTotal && <NavInlineBadge count={total} />}
          <ChevronRight className={cn("size-6 shrink-0 transition-transform", expanded && "rotate-90")} aria-hidden />
        </span>
      </SidebarMenuButton>
      {expanded && (
        <SidebarMenuSub>
          {children.map((child) => {
            const { path, title, icon: ChildIcon } = child;

            return (
              <SidebarMenuSubItem key={path}>
                <SidebarMenuSubButton asChild isActive={isUnder(pathname, path)}>
                  <NavLink to={path}>
                    <ChildIcon />
                    <span className="truncate">{title}</span>
                    <NavInlineBadge count={badgeCount([child], attention)} />
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

export default function NavMain({ attention }: ItemProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {nav.map((item) =>
            item.kind === "page" ? (
              <NavPageItem key={item.path} page={item} count={badgeCount([item], attention)} />
            ) : (
              <NavGroupEntry key={item.group.title} item={item} attention={attention} />
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
