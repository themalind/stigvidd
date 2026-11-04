// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProcessingValues } from "@/features/media/utils/media-upload";

const RESOLUTIONS = [
  { value: "original", label: "Original" },
  { value: "3840", label: "4K — 3840px" },
  { value: "1920", label: "Full HD — 1920px" },
  { value: "1600", label: "1600px" },
  { value: "1280", label: "1280px" },
  { value: "800", label: "800px" },
  { value: "400", label: "400px" },
  { value: "custom", label: "Custom…" },
];

const FORMATS = [
  { value: "original", label: "Keep original" },
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
];

interface Props {
  value: ProcessingValues;
  onChange: (next: ProcessingValues) => void;
}

export function ProcessingControls({ value, onChange }: Props) {
  const id = useId();
  const set = (patch: Partial<ProcessingValues>) => onChange({ ...value, ...patch });

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-resolution`}>Max resolution</Label>
        <Select value={value.resolution} onValueChange={(resolution) => set({ resolution })}>
          <SelectTrigger id={`${id}-resolution`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOLUTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value.resolution === "custom" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={1}
              aria-label="Max width"
              placeholder="Max width"
              value={value.customWidth}
              onChange={(e) => set({ customWidth: e.target.value })}
            />
            <Input
              type="number"
              min={1}
              aria-label="Max height"
              placeholder="Max height"
              value={value.customHeight}
              onChange={(e) => set({ customHeight: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Quality</Label>
          <span className="text-muted-foreground text-sm">{value.quality}</span>
        </div>
        <Slider
          min={10}
          max={100}
          step={1}
          value={[value.quality]}
          onValueChange={([quality]) => set({ quality })}
          thumbLabel="Quality"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-format`}>Format</Label>
        <Select value={value.format} onValueChange={(format) => set({ format })}>
          <SelectTrigger id={`${id}-format`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
