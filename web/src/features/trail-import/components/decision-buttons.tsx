// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { Ban, Check, Info, Link2, Loader2, Plus, RotateCcw, SkipForward } from "lucide-react";
import type { Proposal } from "@/features/trail-import/api/trail-import";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const decisionHelp: { label: string; key: string; text: string }[] = [
  {
    label: "Accept",
    key: "a",
    text: "Keeps the match the analysis found and links the feature to that trail. The trail's name and length stay as they are unless you say otherwise.",
  },
  {
    label: "Relink",
    key: "r",
    text: "Links it to a trail you pick instead — for when the suggestion is the wrong one of two trails that run along each other.",
  },
  {
    label: "New trail",
    key: "n",
    text: "Opens a panel where you name the trail and pick its length, then creates it from this feature's line.",
  },
  {
    label: "Exclude",
    key: "x",
    text: "The feature never becomes a trail. The exclusion is remembered by the shape of the line, so later imports keep it out even though the source renumbers its ids.",
  },
  {
    label: "Skip",
    key: "s",
    text: "No decision, but the row is set apart from the ones you have not looked at yet.",
  },
  {
    label: "Undo",
    key: "u",
    text: "Clears the decision and everything that came with it: the trail, the note, and the name and length you picked. An exclusion inherited from an earlier import comes back at the next analysis.",
  },
];

// keep-comment: the span keeps the tooltip working while the button inside is disabled
function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">{children}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

function DecisionHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="What the decisions do">
          <Info />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <dl className="space-y-3">
          {decisionHelp.map((entry) => (
            <div key={entry.label}>
              <dt className="flex items-center gap-2 text-sm font-medium">
                {entry.label}
                <kbd className="rounded-md border px-1 text-xs font-normal text-muted-foreground">{entry.key}</kbd>
              </dt>
              <dd className="text-xs text-muted-foreground">{entry.text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Accept and Relink also ask what the feature is to the trail: Segment merges its line into the route, Duplicate
          links it without adding geometry.
        </p>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  decision: Proposal["decision"];
  canAccept: boolean;
  settledAsAccept: boolean;
  saving: boolean;
  onAccept: () => void;
  onRelink: () => void;
  onCreateNew: () => void;
  onExclude: () => void;
  onSkip: () => void;
  onUndo: () => void;
}

export function DecisionButtons({
  decision,
  canAccept,
  settledAsAccept,
  saving,
  onAccept,
  onRelink,
  onCreateNew,
  onExclude,
  onSkip,
  onUndo,
}: Props) {
  const excluded = decision === "Exclude";
  const skipped = decision === "Skip";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap items-center gap-2">
        <Hint
          text={
            settledAsAccept
              ? "Already accepted as it stands. Change the role or the length to save it again, or undo it (u)."
              : canAccept
                ? "Links the feature to the suggested trail and keeps that match. The trail's own name and length stay as they are. (a)"
                : "Nothing was suggested for this feature. Relink it to a trail you pick, or create a new one."
          }
        >
          <Button
            variant={settledAsAccept ? "secondary" : "default"}
            onClick={onAccept}
            disabled={saving || !canAccept || settledAsAccept}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            {settledAsAccept ? "Accepted" : "Accept"}
          </Button>
        </Hint>
        <Hint text="Links it to a trail you pick instead of the suggested one, for when two trails run along each other. (r)">
          <Button variant="outline" onClick={onRelink} disabled={saving}>
            <Link2 />
            Relink
          </Button>
        </Hint>
        <Hint text="Opens a panel where you name the trail and pick its length, then creates it from this line. (n)">
          <Button variant="outline" onClick={onCreateNew} disabled={saving}>
            <Plus />
            New trail
          </Button>
        </Hint>
        <Hint
          text={
            excluded
              ? "Already excluded. Undo it (u) to put it back in play."
              : "The feature never becomes a trail. Remembered by the shape of the line, so later imports keep it out. (x)"
          }
        >
          <Button variant={excluded ? "secondary" : "outline"} onClick={onExclude} disabled={saving || excluded}>
            <Ban />
            {excluded ? "Excluded" : "Exclude"}
          </Button>
        </Hint>
        <Hint
          text={
            skipped
              ? "Already skipped. Pick a decision, or undo it (u)."
              : "No decision. Sets the row apart from the ones you have not looked at yet. (s)"
          }
        >
          <Button variant={skipped ? "secondary" : "ghost"} onClick={onSkip} disabled={saving || skipped}>
            <SkipForward />
            {skipped ? "Skipped" : "Skip"}
          </Button>
        </Hint>

        <div className="ml-auto flex items-center gap-2">
          {decision !== "Pending" && (
            <Hint text="Clears the decision and everything that came with it: the trail, the note, the name and the length. (u)">
              <Button variant="ghost" onClick={onUndo} disabled={saving}>
                <RotateCcw />
                Undo
              </Button>
            </Hint>
          )}
          <DecisionHelp />
        </div>
      </div>
    </TooltipProvider>
  );
}
