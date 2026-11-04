// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import type { ProposalDecision, TrailSourceLinkRole } from "@/api/generated/model";
import { useDecideProposal, usePreview, type Proposal } from "@/features/trail-import/api/trail-import";
import {
  initialRole,
  km,
  lengthGapOf,
  repeatsDecision,
  sourcePageOf,
} from "@/features/trail-import/utils/proposal-detail";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge, DecisionBadge } from "./badges";
import { DecisionButtons } from "./decision-buttons";
import { NewTrailPanel } from "./new-trail-panel";
import { ProposalPreview } from "./proposal-preview";
import { RelinkPicker, type RelinkTarget } from "./relink-picker";
import { RolePicker } from "./role-picker";
import { SharingWarning } from "./sharing-warning";

interface Props {
  sessionId: number;
  proposal: Proposal;
  trails: RelinkTarget[] | undefined;
  onDecided: () => void;
  /** An applied session is history: the numbers stay, the controls go. */
  readOnly?: boolean;
}

interface Picked {
  trailIdentifier?: string;
  name?: string;
  lengthKm?: number;
  role?: TrailSourceLinkRole;
}

export function ProposalDetail({ sessionId, proposal, trails, onDecided, readOnly = false }: Props) {
  const preview = usePreview(sessionId, proposal.id);
  const decide = useDecideProposal(sessionId, proposal.id);
  const [note, setNote] = useState(proposal.note ?? "");
  const [role, setRole] = useState<TrailSourceLinkRole>(initialRole(proposal));
  const [relinking, setRelinking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rewriteLength, setRewriteLength] = useState(false);

  const saving = decide.isPending;
  const canAccept = proposal.suggestedTrailId !== null;
  const lengthGap = preview.data ? lengthGapOf(preview.data) : null;
  const sourcePage = sourcePageOf(preview.data?.featureProperties ?? null);
  const settledAsAccept = proposal.decision === "Accept" && proposal.decidedRole === role && !rewriteLength;

  function save(decision: ProposalDecision, picked: Picked = {}) {
    decide.mutate(
      {
        decision,
        trailIdentifier: picked.trailIdentifier,
        role: decision === "Accept" || decision === "Relink" ? (picked.role ?? role) : undefined,
        note: note.trim() || undefined,
        name: picked.name,
        lengthKm: picked.lengthKm,
      },
      {
        onSuccess: () => {
          setCreating(false);
          onDecided();
        },
      },
    );
  }

  const accept = () => save("Accept", { lengthKm: rewriteLength ? lengthGap?.measured : undefined });

  // keep-comment: r and n only open a panel, so a keypress alone never relinks or creates a trail
  function shortcut(decision: ProposalDecision) {
    if (saving) return;
    if (decision === "Relink") return setRelinking(true);
    if (decision === "CreateNew") return setCreating(true);
    if (decision === "Accept" && !canAccept) {
      toast.error("Nothing was suggested for this feature. Relink it or create a new trail.");
      return;
    }
    if (repeatsDecision(decision, proposal, settledAsAccept)) return;
    if (decision === "Accept") return accept();
    save(decision);
  }

  useKeyboardShortcuts(
    readOnly
      ? {}
      : {
          a: () => shortcut("Accept"),
          r: () => shortcut("Relink"),
          n: () => shortcut("CreateNew"),
          x: () => shortcut("Exclude"),
          s: () => shortcut("Skip"),
          u: () => shortcut("Pending"),
        },
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{proposal.featureName || "(no name in source)"}</h2>
          <ConfidenceBadge confidence={proposal.confidence} />
          <DecisionBadge decision={proposal.decision} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>
            Source id {proposal.externalId || "—"}
            {proposal.decidedBy ? ` · decided by ${proposal.decidedBy}` : ""}
          </span>
          {sourcePage && (
            <a
              href={sourcePage}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
            >
              <ExternalLink className="size-3" />
              Source page
            </a>
          )}
          {proposal.decidedName && <span>· to be created as {proposal.decidedName}</span>}
          {proposal.decidedLengthKm !== null && <span>· length {km(proposal.decidedLengthKm)}</span>}
        </div>
      </div>

      {proposal.matchReason && <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">{proposal.matchReason}</p>}

      {preview.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : preview.isError ? (
        <div className="text-sm text-muted-foreground">
          <p>No preview available.</p>
          {preview.error instanceof Error && <p className="text-xs">{preview.error.message}</p>}
        </div>
      ) : (
        <ProposalPreview proposal={proposal} preview={preview.data} />
      )}

      {!readOnly && (
        <>
          <Separator />

          {(canAccept || relinking) && <RolePicker value={role} onChange={setRole} disabled={saving} />}

          <SharingWarning
            sharing={preview.data?.sharingTheTrail ?? []}
            canAccept={canAccept}
            disabled={saving}
            onAccept={(picked) => save("Accept", { role: picked })}
          />

          {canAccept && !relinking && lengthGap && (
            <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <Checkbox
                checked={rewriteLength}
                onCheckedChange={(checked) => setRewriteLength(checked === true)}
                disabled={saving}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-medium">Set the trail's length to {km(lengthGap.measured)}</span>
                <span className="block text-xs text-muted-foreground">
                  It carries {km(preview.data?.trailCuratedLengthKm)} today, and its own line{" "}
                  {lengthGap.longer ? "runs longer" : "runs shorter"} than that. A line that falls short can be a line
                  cut off as easily as a length that was never right, and the drawing above is what tells them apart.
                </span>
              </span>
            </label>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              placeholder="Why this decision, for whoever reads the session later"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {relinking && (
            <RelinkPicker
              trails={trails}
              disabled={saving}
              onPick={(trailIdentifier) => save("Relink", { trailIdentifier })}
              onCancel={() => setRelinking(false)}
            />
          )}

          {creating && (
            <NewTrailPanel
              proposal={proposal}
              preview={preview.data}
              saving={saving}
              onCreate={({ name, lengthKm }) => save("CreateNew", { name, lengthKm })}
              onCancel={() => setCreating(false)}
            />
          )}

          <DecisionButtons
            decision={proposal.decision}
            canAccept={canAccept}
            settledAsAccept={settledAsAccept}
            saving={saving}
            onAccept={accept}
            onRelink={() => setRelinking(true)}
            onCreateNew={() => setCreating(true)}
            onExclude={() => save("Exclude")}
            onSkip={() => save("Skip")}
            onUndo={() => save("Pending")}
          />
        </>
      )}
    </div>
  );
}
