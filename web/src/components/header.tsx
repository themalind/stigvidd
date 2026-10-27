// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect } from "react";
import { useMatches } from "react-router";
import { isStaging } from "@/lib/environment";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { DarkModeToggle } from "./dark-mode-toggle";
import { SidebarTrigger } from "./ui/sidebar";

type RouteHandle = {
  title?: string;
};

export default function Header() {
  const matches = useMatches() as Array<{ handle: RouteHandle }>;

  const currentTitle = [...matches].reverse().find((match) => match.handle?.title)?.handle?.title ?? "Stigvidd";

  useEffect(() => {
    document.title = isStaging ? `[STAGING] ${currentTitle}` : currentTitle;
  }, [currentTitle]);

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex justify-between items-center p-2 border-t-8 border-b",
        isStaging ? "bg-amber-100 dark:bg-amber-950 border-t-amber-500" : "bg-background border-t-sidebar",
      )}
    >
      <div className="flex pl-1 items-center">
        <SidebarTrigger />
      </div>
      <div className="flex items-center gap-2">
        {isStaging && <Badge variant="destructive">STAGING</Badge>}
        <h1 className="text-2xl">{currentTitle}</h1>
      </div>
      <div className="pr-1">
        <DarkModeToggle />
      </div>
    </header>
  );
}
