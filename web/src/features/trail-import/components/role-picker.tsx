// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { LinkRole } from "@/features/trail-import/api/trail-import";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// keep-comment: Excluded is set by the server for Exclude, so a reviewer only picks these two
const roleChoices: { value: LinkRole; label: string; hint: string }[] = [
  {
    value: "Segment",
    label: "Segment",
    hint: "Part of the trail's route. Its geometry is merged into the trail's path.",
  },
  {
    value: "Duplicate",
    label: "Duplicate",
    hint: "Belongs to the trail but adds no geometry, such as an aggregate of several stages.",
  },
];

interface Props {
  value: LinkRole;
  onChange: (role: LinkRole) => void;
  disabled: boolean;
}

export function RolePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">What this feature is to the trail</p>
      <RadioGroup value={value} onValueChange={(next) => onChange(next as LinkRole)}>
        {roleChoices.map((choice) => (
          <label
            key={choice.value}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
              value === choice.value ? "border-primary bg-accent/40" : ""
            }`}
          >
            <RadioGroupItem value={choice.value} className="mt-0.5" disabled={disabled} />
            <span>
              <span className="text-sm font-medium">{choice.label}</span>
              <span className="block text-xs text-muted-foreground">{choice.hint}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}
