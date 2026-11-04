// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const WIDTHS = {
  narrow: "max-w-3xl",
  default: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-[1500px]",
} as const;

interface PageProps {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
}

export function Page({ children, width = "default", className }: PageProps) {
  return <main className={cn("container mx-auto space-y-6 px-4 py-10", WIDTHS[width], className)}>{children}</main>;
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
    </Card>
  );
}
