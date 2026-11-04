// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASSIFICATION } from "@/utils/classification";
import type { FacilityOption, OwnerList, TargetType, TrailOption } from "@/features/media/utils/media-upload";

// keep-comment: trails can share a name, so the label carries length and city to tell them apart
function trailLabel(trail: TrailOption): string {
  return `${trail.name} — ${[`${trail.trailLength} km`, trail.city].filter(Boolean).join(" · ")}`;
}

interface Props {
  targetType: TargetType;
  targetId: string;
  trails: OwnerList<TrailOption>;
  facilities: OwnerList<FacilityOption>;
  onTargetTypeChange: (next: TargetType) => void;
  onTargetIdChange: (next: string) => void;
}

export function UploadTargetPicker({
  targetType,
  targetId,
  trails,
  facilities,
  onTargetTypeChange,
  onTargetIdChange,
}: Props) {
  const isFacility = targetType === "facility";
  const sortedTrails = useMemo(
    () => [...(trails.items ?? [])].sort((a, b) => a.name.localeCompare(b.name) || a.trailLength - b.trailLength),
    [trails.items],
  );
  const sortedFacilities = useMemo(
    () => [...(facilities.items ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [facilities.items],
  );
  const options = isFacility
    ? sortedFacilities.map((f) => ({ value: f.identifier, label: f.name }))
    : sortedTrails.map((t) => ({ value: t.identifier, label: trailLabel(t) }));
  const failed = isFacility ? facilities.failed : trails.failed;
  const selectedTrail = isFacility ? undefined : sortedTrails.find((t) => t.identifier === targetId);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="target-type">Attach to</Label>
          <Select value={targetType} onValueChange={(v) => onTargetTypeChange(v as TargetType)}>
            <SelectTrigger id="target-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trail-gallery">Trail — gallery</SelectItem>
              <SelectItem value="trail-symbol">Trail — symbol</SelectItem>
              <SelectItem value="facility">Facility</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target">{isFacility ? "Facility" : "Trail"}</Label>
          <Select value={targetId} onValueChange={onTargetIdChange}>
            <SelectTrigger id="target" className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {failed && (
            <p role="alert" className="text-destructive text-xs">
              The {isFacility ? "facilities" : "trails"} could not be loaded.
            </p>
          )}
        </div>
      </div>

      {selectedTrail && (
        <div className="bg-muted/40 space-y-1 rounded-xs border p-3 text-xs">
          <p className="text-sm font-medium">{selectedTrail.name}</p>
          <p className="text-muted-foreground">
            {selectedTrail.trailLength} km
            {selectedTrail.city ? ` · ${selectedTrail.city}` : ""} ·{" "}
            {CLASSIFICATION[selectedTrail.classification] ?? "Unknown"} ·{" "}
            {selectedTrail.accessibility ? "Accessible" : "Not accessible"}
          </p>
          <p className="text-muted-foreground font-mono text-[10px] break-all">{selectedTrail.identifier}</p>
        </div>
      )}
    </>
  );
}
