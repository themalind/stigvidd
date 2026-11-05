// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowRight, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function display(value: number | undefined | null): string {
  if (value === undefined) return "…";
  if (value === null) return "—";
  return value.toLocaleString("sv-SE");
}

// keep-comment: plain figures take the theme's colour; amber only marks what wants a human, green only all clear
export const CHIPS = {
  plain: "bg-accent/60 text-primary",
  attention: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  clear: "bg-emerald-600/10 text-emerald-800 dark:text-emerald-200",
} as const;

interface AttentionCardProps {
  label: string;
  value: number | undefined | null;
  to: string;
  icon: LucideIcon;
}

export function AttentionCard({ label, value, to, icon: Icon }: AttentionCardProps) {
  const pending = typeof value === "number" && value > 0;
  const clear = value === 0;

  return (
    <Link
      to={to}
      className={cn(
        "group flex items-center gap-4 rounded-xs border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        pending && "border-amber-500/40",
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xs",
          pending ? CHIPS.attention : clear ? CHIPS.clear : "bg-muted text-muted-foreground",
        )}
      >
        {clear ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-muted-foreground truncate text-sm">{label}</span>
        <span
          className="text-2xl font-semibold tabular-nums"
          title={value === null ? "Could not be loaded" : undefined}
        >
          {clear ? (
            <span className="text-base font-medium text-emerald-800 dark:text-emerald-200">All clear</span>
          ) : (
            display(value)
          )}
        </span>
      </span>
      <ArrowRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

interface MetricCardProps {
  label: string;
  value: number | undefined | null;
  delta?: number | null;
  detail?: string;
  to?: string;
  icon: LucideIcon;
}

export function MetricCard({ label, value, delta, detail, to, icon: Icon }: MetricCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        <span className={cn("flex size-9 items-center justify-center rounded-xs", CHIPS.plain)}>
          <Icon className="size-4" />
        </span>
      </div>
      <span className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{display(value)}</span>
      <span className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
        {typeof delta === "number" && (
          <span
            className={cn(
              "rounded-xs px-1.5 py-0.5 font-medium",
              delta > 0 ? CHIPS.plain : "bg-muted text-muted-foreground",
            )}
          >
            +{delta.toLocaleString("sv-SE")}
          </span>
        )}
        {detail}
      </span>
    </>
  );

  const className = "flex flex-col rounded-xs border bg-card p-5";

  return to ? (
    <Link to={to} className={cn(className, "transition-all hover:-translate-y-0.5 hover:shadow-md")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function HealthBar({ label, percent, to }: { label: string; percent: number; to: string }) {
  return (
    <Link to={to} className="group flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-sm">
        <span className="group-hover:underline">{label}</span>
        <span className="font-medium tabular-nums">{percent}%</span>
      </span>
      <span className="bg-muted h-2 overflow-hidden rounded-xs">
        <span
          className="bg-primary/70 block h-full rounded-xs transition-[width] duration-700"
          style={{ width: `${percent}%` }}
        />
      </span>
    </Link>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">{children}</h2>;
}
