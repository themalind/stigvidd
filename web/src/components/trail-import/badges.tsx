// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Badge } from "@/components/ui/badge";
import type { Confidence, Decision, SessionStatus } from "@/api/trail-import";

// Colour carries the same meaning everywhere in the review: green is settled, amber wants
// a human, grey is untouched, red went wrong.

const confidenceStyle: Record<string, string> = {
  Certain: "bg-emerald-600 text-white",
  High: "bg-emerald-600/70 text-white",
  Medium: "bg-amber-500 text-black",
  Unmatched: "bg-muted text-muted-foreground border-border",
};

const confidenceHint: Record<string, string> = {
  Certain: "Identical geometry fingerprint",
  High: "Strong spatial overlap",
  Medium: "Plausible — needs a human",
  Unmatched: "No trail found",
};

export function ConfidenceBadge({
  confidence,
}: {
  confidence: Confidence | string;
}) {
  return (
    <Badge
      variant="outline"
      className={confidenceStyle[confidence] ?? ""}
      title={confidenceHint[confidence]}
    >
      {confidence}
    </Badge>
  );
}

const decisionStyle: Record<string, string> = {
  Pending: "bg-muted text-muted-foreground border-border",
  Accept: "bg-emerald-600 text-white",
  Relink: "bg-sky-600 text-white",
  CreateNew: "bg-violet-600 text-white",
  Exclude: "bg-destructive text-white",
  Skip: "bg-muted text-muted-foreground border-border",
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
  return (
    <Badge variant="outline" className={decisionStyle[decision] ?? ""}>
      {decisionLabel[decision] ?? decision}
    </Badge>
  );
}

const statusStyle: Record<string, string> = {
  Uploaded: "bg-muted text-muted-foreground border-border",
  Analyzing: "bg-sky-600 text-white",
  AwaitingReview: "bg-amber-500 text-black",
  Applying: "bg-sky-600 text-white",
  Applied: "bg-emerald-600 text-white",
  Failed: "bg-destructive text-white",
};

const statusLabel: Record<string, string> = {
  AwaitingReview: "Awaiting review",
};

export function StatusBadge({ status }: { status: SessionStatus | string }) {
  return (
    <Badge variant="outline" className={statusStyle[status] ?? ""}>
      {statusLabel[status] ?? status}
    </Badge>
  );
}
