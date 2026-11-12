// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AdminCityAreaBoundaryPreviewResponse, AdminCityAreaPreviewTrailResponse } from "@/api/generated/model";

function trailLabel(trail: AdminCityAreaPreviewTrailResponse): string {
  return `${trail.name} (${Math.round(trail.shareInside * 100)} % inside)`;
}

function Line({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p>
      <span className="font-medium">{label}:</span> {names.join(", ")}
    </p>
  );
}

export function BoundaryPreviewSummary({ preview }: { preview: AdminCityAreaBoundaryPreviewResponse }) {
  const { addedTrails, removedTrails, addedFacilities, removedFacilities } = preview;
  const unchanged = addedTrails.length + removedTrails.length + addedFacilities.length + removedFacilities.length === 0;

  return (
    <section className="space-y-1 rounded-xs border border-input px-3 py-2 text-sm" aria-label="What saving changes">
      {unchanged ? (
        <p className="text-muted-foreground">Saving this boundary changes nothing in the area.</p>
      ) : (
        <>
          <Line label="Saving adds trails" names={addedTrails.map(trailLabel)} />
          <Line label="Saving adds facilities" names={addedFacilities.map((f) => f.name)} />
          <Line label="Saving removes trails" names={removedTrails.map(trailLabel)} />
          <Line label="Saving removes facilities" names={removedFacilities.map((f) => f.name)} />
        </>
      )}
    </section>
  );
}
