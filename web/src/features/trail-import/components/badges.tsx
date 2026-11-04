// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ToneBadge, type Tone } from "@/components/tone-badge";
import type { Confidence, Decision, SessionStatus } from "@/features/trail-import/api/trail-import";

const confidenceTone: Record<string, Tone> = {
  Certain: "ok",
  High: "okSoft",
  Medium: "warn",
  Unmatched: "muted",
};

const confidenceHint: Record<string, string> = {
  Certain: "Identical geometry fingerprint",
  High: "Strong spatial overlap",
  Medium: "Plausible — needs a human",
  Unmatched: "No trail found",
};

export function ConfidenceBadge({ confidence }: { confidence: Confidence | string }) {
  return (
    <ToneBadge tone={confidenceTone[confidence]} title={confidenceHint[confidence]}>
      {confidence}
    </ToneBadge>
  );
}

const decisionTone: Record<string, Tone> = {
  Pending: "muted",
  Accept: "ok",
  Relink: "busy",
  CreateNew: "created",
  Exclude: "bad",
  Skip: "muted",
};

export const decisionLabel: Record<string, string> = {
  Pending: "Undecided",
  Accept: "Accepted",
  Relink: "Relinked",
  CreateNew: "New trail",
  Exclude: "Excluded",
  Skip: "Skipped",
};

export function DecisionBadge({ decision }: { decision: Decision | string }) {
  return <ToneBadge tone={decisionTone[decision]}>{decisionLabel[decision] ?? decision}</ToneBadge>;
}

const statusTone: Record<string, Tone> = {
  Uploaded: "muted",
  Analyzing: "busy",
  AwaitingReview: "warn",
  Applying: "busy",
  Applied: "ok",
  Failed: "bad",
};

const statusLabel: Record<string, string> = {
  AwaitingReview: "Awaiting review",
};

export function StatusBadge({ status }: { status: SessionStatus | string }) {
  return <ToneBadge tone={statusTone[status]}>{statusLabel[status] ?? status}</ToneBadge>;
}
