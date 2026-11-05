// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { TrailSourceLinkRole } from "@/api/generated/model";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// keep-comment: Excluded is set by the server for Exclude, so a reviewer only picks these two
const roleChoices: { value: TrailSourceLinkRole; label: string; hint: string }[] = [
  {
    value: TrailSourceLinkRole.Segment,
    label: "Segment",
    hint: "Part of the trail's route. Its geometry is merged into the trail's path.",
  },
  {
    value: TrailSourceLinkRole.Duplicate,
    label: "Duplicate",
    hint: "Belongs to the trail but adds no geometry, such as an aggregate of several stages.",
  },
];

interface Props {
  value: TrailSourceLinkRole;
  onChange: (role: TrailSourceLinkRole) => void;
  disabled: boolean;
}

export function RolePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">What this feature is to the trail</p>
      <RadioGroup
        value={value}
        onValueChange={(next) => {
          const picked = roleChoices.find((choice) => choice.value === next);
          if (picked) onChange(picked.value);
        }}
      >
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
