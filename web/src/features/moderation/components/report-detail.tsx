// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, TriangleAlert } from "lucide-react";
import type { ContentReportDetailResponse } from "@/api/generated/model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { reportQueryOptions, useDecideReport } from "@/features/moderation/api/content-reports";
import {
  canDecide,
  dismissEnabled,
  reporterRisk,
  strikeAfterUphold,
  upholdEnabled,
} from "@/features/moderation/utils/moderation-review";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

const contentTypeNoun: Record<string, string> = {
  Review: "review",
  TrailObstacle: "obstacle report",
  HikeImage: "hike image",
};

const riskLabel: Record<string, string> = {
  unknown: "No history",
  clean: "Never dismissed",
  watch: "Some dismissed",
  unreliable: "Often dismissed",
};

interface Props {
  identifier: string;
  // keep-comment: the ban controls come from the users feature, so the page composes them in
  renderAuthorActions?: (detail: ContentReportDetailResponse) => ReactNode;
}

export function ReportDetail({ identifier, renderAuthorActions }: Props) {
  const { data: detail } = useSuspenseQuery(reportQueryOptions(identifier));
  const { report } = detail;
  // keep-comment: Uphold hard-deletes, so it stays off until the content has actually been opened
  const [hasReadContent, setHasReadContent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const decide = useDecideReport(identifier);
  const noun = contentTypeNoun[report.contentType];

  const dismiss = () => decide.mutate({ decision: "Dismiss", note: note.trim() || undefined });
  const uphold = () =>
    decide.mutate({ decision: "Uphold", note: note.trim() || undefined }, { onSuccess: () => setConfirming(false) });

  // keep-comment: `u` only prepares an uphold; confirming it is a second, deliberate action
  useKeyboardShortcuts({
    d: () => dismissEnabled(report) && !decide.isPending && dismiss(),
    u: () => upholdEnabled(report, hasReadContent) && setConfirming(true),
  });

  return (
    <>
      {!report.contentStillExists && (
        <div data-testid="content-gone" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          <TriangleAlert className="mb-1 inline size-4" /> The content is no longer there, so only this snapshot
          remains. Upholding still records the strike.
        </div>
      )}

      <article className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Reported content</h2>
        {report.contentImageUrl ? (
          <a
            href={report.contentImageUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block w-fit"
            onMouseEnter={() => setHasReadContent(true)}
            onFocus={() => setHasReadContent(true)}
          >
            <img
              data-testid="content-image"
              src={report.contentImageUrl}
              alt={`The reported ${noun ?? "image"}`}
              className="max-h-80 rounded-md border object-contain"
            />
          </a>
        ) : (
          <p
            data-testid="content-snapshot"
            className="mt-2 whitespace-pre-wrap text-sm"
            onMouseEnter={() => setHasReadContent(true)}
            onFocus={() => setHasReadContent(true)}
            tabIndex={0}
          >
            {report.contentSnapshot ?? "The snapshot was cleared with the author's account."}
          </p>
        )}
        {!hasReadContent && (
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            data-testid="mark-read"
            onClick={() => setHasReadContent(true)}
          >
            I have read this
          </Button>
        )}
      </article>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-md border p-4 text-sm">
          <h2 className="font-semibold">Author</h2>
          <p className="text-muted-foreground">{report.authorNickName ?? "Deleted author"}</p>
          <p data-testid="author-strikes">
            {detail.authorStrikes} strike{detail.authorStrikes === 1 ? "" : "s"}
          </p>
          {renderAuthorActions?.(detail)}
        </article>

        <article className="rounded-md border p-4 text-sm">
          <h2 className="font-semibold">Reporter</h2>
          <p className="text-muted-foreground">{report.reporterNickName ?? "Deleted reporter"}</p>
          <p data-testid="reporter-record">
            {detail.reporterTotal} reports, {detail.reporterDismissed} dismissed
          </p>
          <Badge variant="outline" data-testid="reporter-risk">
            {riskLabel[reporterRisk(detail)]}
          </Badge>
          {report.reporterNote && <p className="mt-2 whitespace-pre-wrap">{report.reporterNote}</p>}
        </article>
      </div>

      {canDecide(report) ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            data-testid="dismiss"
            disabled={!dismissEnabled(report) || decide.isPending}
            onClick={dismiss}
          >
            {decide.isPending && <Loader2 className="size-4 animate-spin" />}
            Nothing wrong, put it back
          </Button>
          <Button
            variant="destructive"
            data-testid="uphold"
            disabled={!upholdEnabled(report, hasReadContent) || decide.isPending}
            onClick={() => setConfirming(true)}
          >
            Breaks the rules, delete it
          </Button>
          {!hasReadContent && (
            <span className="text-xs text-muted-foreground">Read the content before deleting it.</span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Decided {report.status.toLowerCase()} by {report.decidedBy ?? "unknown"}
          {report.decidedAt ? ` on ${new Date(report.decidedAt).toLocaleString()}` : ""}.
          {report.decisionNote ? ` ${report.decisionNote}` : ""}
        </p>
      )}

      <Sheet open={confirming} onOpenChange={setConfirming}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Delete this content permanently?</SheetTitle>
            <SheetDescription data-testid="confirm-body">
              This deletes {report.authorNickName ?? "the author"}
              {"'"}s {noun ?? "content"} for good. It cannot be undone. It becomes strike{" "}
              {strikeAfterUphold(detail.authorStrikes, false)} against them.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4">
            <Textarea
              data-testid="decision-note"
              placeholder="Why (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <SheetFooter>
            <Button variant="destructive" data-testid="confirm-uphold" disabled={decide.isPending} onClick={uphold}>
              {decide.isPending && <Loader2 className="size-4 animate-spin" />}
              Delete permanently
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
