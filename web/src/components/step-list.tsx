// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StepListProps {
  label: string;
  steps: readonly string[];
  // keep-comment: the index of the step being worked on; the ones before it are done
  current: number;
}

export function StepList({ label, steps, current }: StepListProps) {
  return (
    <ol aria-label={label} className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm",
              active ? "border-primary bg-primary/10" : "border-border",
              index > current && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-emerald-600/20 text-emerald-600",
                active && "bg-primary text-primary-foreground",
                index > current && "bg-muted",
              )}
            >
              {done ? <Check className="size-3" aria-label="done" /> : index + 1}
            </span>
            {step}
          </li>
        );
      })}
    </ol>
  );
}

interface StepSummaryProps {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  onChange: () => void;
}

export function StepSummary({ label, children, disabled = false, onChange }: StepSummaryProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-sm border px-4 py-2.5 text-sm">
      <Check className="size-4 text-emerald-600" aria-hidden />
      <span className="min-w-16 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 font-medium break-words">{children}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        aria-label={`Change ${label.toLowerCase()}`}
        onClick={onChange}
      >
        Change
      </Button>
    </div>
  );
}
