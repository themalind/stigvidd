// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SidebarMenuBadge } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const COLORS =
  "bg-primary text-primary-foreground peer-hover/menu-button:text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground";

function Count({ count }: { count: number }) {
  return (
    <>
      <span className="sr-only">, </span>
      {count}
      <span className="sr-only"> waiting</span>
    </>
  );
}

// keep-comment: beside a top-level entry; the collapsed icon sidebar hides the number, so a dot on the icon stands in
export function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <>
      <SidebarMenuBadge className={COLORS}>
        <Count count={count} />
      </SidebarMenuBadge>
      <span
        aria-hidden
        className="bg-primary pointer-events-none absolute top-1.5 left-5 hidden size-2 rounded-full group-data-[collapsible=icon]:block"
      />
    </>
  );
}

// keep-comment: inside an open group, where the sub-button lays its children out in a row
export function NavSubBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span
      className={cn(
        "ml-auto flex h-5 shrink-0 min-w-5 items-center justify-center rounded-xs px-1 text-xs font-medium tabular-nums",
        COLORS,
      )}
    >
      <Count count={count} />
    </span>
  );
}
