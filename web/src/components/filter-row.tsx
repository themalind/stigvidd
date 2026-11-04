// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Button } from "@/components/ui/button";

interface Props {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}

export function FilterRow({ label, options, value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 text-sm" role="group" aria-label={label}>
      <span className="text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={option === value ? "default" : "ghost"}
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}
