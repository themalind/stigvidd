// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AlertTriangle } from "lucide-react";
import type { Preview, Proposal } from "@/features/trail-import/api/trail-import";
import { km, percent } from "@/features/trail-import/utils/proposal-detail";
import { ProposalMap } from "./proposal-map";

function CoverageBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="space-y-1" title={hint}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{percent(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: percent(value) }} />
      </div>
    </div>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium tabular-nums ${warn ? "text-amber-600" : ""}`}>{value}</p>
    </div>
  );
}

export function ProposalPreview({ proposal, preview }: { proposal: Proposal; preview: Preview }) {
  return (
    <>
      <ProposalMap feature={preview.featureCoordinates} trail={preview.trailCoordinates} className="h-72" />

      {preview.trailIsNearestOnly && preview.trailName && (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
          Drawn alongside is <span className="font-medium">{preview.trailName}</span>, the nearest trail. Nothing
          matched this feature, so it is only what the coverage was measured against — not a suggestion.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fact label="Feature, measured" value={km(preview.featureLengthKm)} />
        <Fact label="Source says" value={km(preview.sourceStatedLengthKm)} warn={preview.sourceLengthDisagrees} />
        <Fact label="Trail, curated" value={km(preview.trailCuratedLengthKm)} />
        <Fact label="Trail, measured" value={km(preview.trailMeasuredLengthKm)} />
      </div>

      {preview.sourceLengthDisagrees && (
        <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          The length the source states is far from what its own geometry measures. Trust the measurement, not the label.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <CoverageBar
          label="Feature lies on the trail"
          value={proposal.coverageForward}
          hint="How much of the source feature runs along the matched trail, within 15 m"
        />
        <CoverageBar
          label="Trail lies on the feature"
          value={proposal.coverageBackward}
          hint="How much of the trail runs along the source feature, within 15 m"
        />
      </div>

      {proposal.hausdorffMeters !== null && (
        <p className="text-xs text-muted-foreground">
          Largest deviation between the two lines:{" "}
          <span className="font-medium tabular-nums">{Math.round(proposal.hausdorffMeters).toLocaleString()} m</span>.
          This measures distance, not length — a rerouted stretch can deviate far and still be the same trail.
        </p>
      )}
    </>
  );
}
