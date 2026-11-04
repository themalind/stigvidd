// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ToneBadge, type Tone } from "@/components/tone-badge";
import type { ImportSessionStatus, MatchConfidence, ProposalDecision } from "@/api/generated/model";

const confidenceTone: Record<MatchConfidence, Tone> = {
  Certain: "ok",
  High: "okSoft",
  Medium: "warn",
  Unmatched: "muted",
};

const confidenceHint: Record<MatchConfidence, string> = {
  Certain: "Identical geometry fingerprint",
  High: "Strong spatial overlap",
  Medium: "Plausible — needs a human",
  Unmatched: "No trail found",
};

export function ConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  return (
    <ToneBadge tone={confidenceTone[confidence]} title={confidenceHint[confidence]}>
      {confidence}
    </ToneBadge>
  );
}

const decisionTone: Record<ProposalDecision, Tone> = {
  Pending: "muted",
  Accept: "ok",
  Relink: "busy",
  CreateNew: "created",
  Exclude: "bad",
  Skip: "muted",
};

export const decisionLabel: Record<ProposalDecision, string> = {
  Pending: "Undecided",
  Accept: "Accepted",
  Relink: "Relinked",
  CreateNew: "New trail",
  Exclude: "Excluded",
  Skip: "Skipped",
};

export function DecisionBadge({ decision }: { decision: ProposalDecision }) {
  return <ToneBadge tone={decisionTone[decision]}>{decisionLabel[decision]}</ToneBadge>;
}

const statusTone: Record<ImportSessionStatus, Tone> = {
  Uploaded: "muted",
  Analyzing: "busy",
  AwaitingReview: "warn",
  Applying: "busy",
  Applied: "ok",
  Failed: "bad",
};

const statusLabel: Partial<Record<ImportSessionStatus, string>> = {
  AwaitingReview: "Awaiting review",
};

export function StatusBadge({ status }: { status: ImportSessionStatus }) {
  return <ToneBadge tone={statusTone[status]}>{statusLabel[status] ?? status}</ToneBadge>;
}
