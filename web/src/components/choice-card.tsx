// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function ChoiceCard({ title, description, selected, disabled = false, onSelect }: Props) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-1 rounded-sm border-2 px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
      )}
    >
      <span className="font-medium">{title}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </button>
  );
}
