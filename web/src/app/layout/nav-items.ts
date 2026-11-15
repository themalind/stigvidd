// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LucideIcon } from "lucide-react";
import type { Attention, AttentionKey } from "@/api/attention";
import type { AppPage, NavGroup } from "../pages";

export interface NavPage {
  kind: "page";
  path: string;
  title: string;
  icon: LucideIcon;
  badge?: AttentionKey;
}

export interface NavGroupItem {
  kind: "group";
  group: NavGroup;
  pages: NavPage[];
}

export type NavItem = NavPage | NavGroupItem;

// keep-comment: a group takes the sidebar slot of its first page, so pages.ts order still decides the menu
export function buildNav(pages: readonly AppPage[]): NavItem[] {
  const items: NavItem[] = [];
  const groups = new Map<NavGroup, NavGroupItem>();

  for (const { path, title, icon, group, badge } of pages) {
    if (!icon) continue;

    const page: NavPage = { kind: "page", path, title, icon, badge };

    if (!group) {
      items.push(page);
      continue;
    }

    const existing = groups.get(group);

    if (existing) {
      existing.pages.push(page);
    } else {
      const item: NavGroupItem = { kind: "group", group, pages: [page] };
      groups.set(group, item);
      items.push(item);
    }
  }

  return items;
}

// keep-comment: 0 while the counts are loading or failed, so a badge never shows a guess
export function badgeCount(pages: readonly NavPage[], attention: Attention | undefined): number {
  return pages.reduce((sum, { badge }) => sum + (badge && attention ? attention[badge] : 0), 0);
}

export function isUnder(pathname: string, path: string): boolean {
  const base = path.split("?")[0] ?? path;

  return pathname === base || pathname.startsWith(`${base}/`);
}
