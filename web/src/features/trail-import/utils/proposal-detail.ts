// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ProposalDecision, TrailSourceLinkRole } from "@/api/generated/model";
import type { Preview, Proposal } from "@/features/trail-import/api/trail-import";

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function km(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${value.toLocaleString()} km`;
}

// keep-comment: the properties come straight from the municipality's export, so only web schemes may reach an href
export function sourcePageOf(featureProperties: string | null): string | null {
  if (!featureProperties) return null;

  try {
    const link = (JSON.parse(featureProperties) as { link?: unknown }).link;
    if (typeof link !== "string") return null;

    const url = new URL(link);

    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export interface LengthGap {
  measured: number;
  longer: boolean;
}

// keep-comment: half a kilometre and a tenth of the length, so the half-kilometre rounding on the signs stays out of the way
export function lengthGapOf(
  preview: Pick<Preview, "trailCuratedLengthKm" | "trailMeasuredLengthKm">,
): LengthGap | null {
  const curated = preview.trailCuratedLengthKm;
  const measured = preview.trailMeasuredLengthKm;

  if (curated === null || measured === null || curated <= 0) return null;

  const gap = Math.abs(curated - measured);

  if (gap < 0.5 || gap / curated < 0.1) return null;

  return { measured, longer: measured > curated };
}

// keep-comment: a trail whose features are all duplicates has nothing to build its line from
export function carrierOf(sharing: Preview["sharingTheTrail"]) {
  return sharing.find(
    (other) => (other.decision === "Accept" || other.decision === "Relink") && other.decidedRole === "Segment",
  );
}

export function initialRole(proposal: Pick<Proposal, "decidedRole">): TrailSourceLinkRole {
  return proposal.decidedRole === "Duplicate" ? "Duplicate" : "Segment";
}

// keep-comment: a decision that would save the row exactly as it stands reads as the screen flinching
export function repeatsDecision(
  decision: ProposalDecision,
  proposal: Pick<Proposal, "decision">,
  settledAsAccept: boolean,
): boolean {
  if (decision === "Accept") return settledAsAccept;
  if (decision === "Pending" || decision === "Exclude" || decision === "Skip") return proposal.decision === decision;
  return false;
}
