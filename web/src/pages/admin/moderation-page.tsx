// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Flag, Loader2, TriangleAlert } from "lucide-react";
import {
  decideReport,
  getCounts,
  getReport,
  getReports,
  type ReportCounts,
  type ReportDetail,
  type ReportSummary,
} from "@/api/content-reports";
import {
  canDecide,
  didNotHide,
  dismissEnabled,
  hideOutcomeExplanation,
  narrowedBy,
  reporterRisk,
  strikeAfterUphold,
  upholdEnabled,
} from "@/lib/moderation-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PageSize = 25;

// Anything the moderator could be typing or picking in. `u` prepares an uphold, so a
// keypress landing while they type must never touch a decision. Asking what the target
// sits inside rather than what it is catches contenteditable and every Radix trigger.
const EditableTargets =
  'input, textarea, select, [contenteditable="true"], [role="textbox"], ' +
  '[role="combobox"], [role="listbox"], [role="searchbox"]';

const statusFilters = ["Pending", "Dismissed", "Upheld", "ContentExpired", "All"] as const;
const contentTypeFilters = ["All", "Review", "TrailObstacle"] as const;
const hideOutcomeFilters = [
  "All",
  "Hidden",
  "AlreadyHidden",
  "WithheldReporterDismissed",
] as const;

const riskLabel: Record<string, string> = {
  unknown: "No history",
  clean: "Never dismissed",
  watch: "Some dismissed",
  unreliable: "Often dismissed",
};

export default function ModerationPage() {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [counts, setCounts] = useState<ReportCounts | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [status, setStatus] = useState<string>("Pending");
  const [contentType, setContentType] = useState<string>("All");
  const [hideOutcome, setHideOutcome] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  // Uphold hard-deletes, so it stays off until the content has actually been opened.
  const [hasReadContent, setHasReadContent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const filters = useMemo(
    () => ({
      status: status === "All" ? undefined : status,
      contentType: contentType === "All" ? undefined : contentType,
      hideOutcome: hideOutcome === "All" ? undefined : hideOutcome,
    }),
    [status, contentType, hideOutcome],
  );

  const load = useCallback(async () => {
    try {
      const [paged, loadedCounts] = await Promise.all([
        getReports({ ...filters, page, pageSize: PageSize }),
        getCounts(),
      ]);

      setReports(paged.items ?? []);
      setTotal(paged.totalCount ?? 0);
      setHasMore(paged.hasMore ?? false);
      setCounts(loadedCounts);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The queue could not be loaded.",
      );
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep a row selected as the list changes, so the keyboard never lands on nothing.
  useEffect(() => {
    if (!reports || reports.length === 0) {
      setSelected(null);
      return;
    }

    setSelected((current) =>
      current !== null && reports.some((r) => r.identifier === current)
        ? current
        : reports[0].identifier,
    );
  }, [reports]);

  // The detail carries the author's strike count and the reporter's record, neither of
  // which the list row has.
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }

    let current = true;
    setHasReadContent(false);
    setDecisionNote("");

    getReport(selected)
      .then((loaded) => {
        if (current) setDetail(loaded);
      })
      .catch(() => {
        if (current) toast.error("The report could not be loaded.");
      });

    return () => {
      current = false;
    };
  }, [selected]);

  const step = useCallback(
    (offset: number) => {
      if (!reports || reports.length === 0) return;

      const index = reports.findIndex((r) => r.identifier === selected);
      const next = Math.min(Math.max(index + offset, 0), reports.length - 1);
      setSelected(reports[next].identifier);
    },
    [reports, selected],
  );

  const report = detail?.report ?? null;

  const decide = useCallback(
    async (decision: "Dismiss" | "Uphold") => {
      if (!selected) return;

      setSaving(true);

      try {
        await decideReport(selected, decision, decisionNote.trim() || undefined);
        setConfirming(false);
        toast.success(
          decision === "Uphold"
            ? "The content was removed and a strike recorded."
            : "The content is visible again.",
        );
        await load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "The decision could not be saved.",
        );
      } finally {
        setSaving(false);
      }
    },
    [selected, decisionNote, load],
  );

  // `u` only prepares the decision. Confirming it is a second, deliberate action, because
  // upholding deletes the content and there is no undo.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.(EditableTargets)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const shortcuts: Record<string, () => void> = {
        j: () => step(1),
        k: () => step(-1),
        d: () => {
          if (dismissEnabled(report)) void decide("Dismiss");
        },
        u: () => {
          if (upholdEnabled(report, hasReadContent)) setConfirming(true);
        },
      };

      const action = shortcuts[event.key.toLowerCase()];
      if (!action) return;

      event.preventDefault();
      action();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, report, hasReadContent, decide]);

  const narrowed = narrowedBy(filters);
  const risk = reporterRisk(
    detail
      ? {
          reporterTotal: detail.reporterTotal ?? 0,
          reporterDismissed: detail.reporterDismissed ?? 0,
        }
      : null,
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Flag className="size-5" />
        <h1 className="text-lg font-semibold">Moderation</h1>
        {counts && (
          <span className="text-sm text-muted-foreground">
            {counts.pending} pending · {counts.dismissed} dismissed · {counts.upheld} upheld
            · {counts.contentExpired} expired
          </span>
        )}
      </header>

      <div className="flex flex-wrap gap-4">
        <FilterRow label="Status" options={statusFilters} value={status} onChange={setStatus} />
        <FilterRow
          label="Type"
          options={contentTypeFilters}
          value={contentType}
          onChange={setContentType}
        />
        <FilterRow
          label="Outcome"
          options={hideOutcomeFilters}
          value={hideOutcome}
          onChange={setHideOutcome}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <section className="flex flex-col gap-2">
          {reports === null && (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          )}

          {reports?.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {narrowed.length > 0
                ? `Nothing matches ${narrowed.join(", ")}.`
                : "Nothing has been reported."}
            </div>
          )}

          {reports?.map((row) => (
            <button
              key={row.identifier}
              type="button"
              data-testid="report-row"
              aria-current={row.identifier === selected}
              onClick={() => setSelected(row.identifier)}
              className={`rounded-md border p-3 text-left text-sm ${
                row.identifier === selected ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline">{row.contentType}</Badge>
                <Badge variant="outline">{row.reason}</Badge>
                <Badge variant="outline">{row.status}</Badge>
                {didNotHide(row.hideOutcome) && (
                  <span
                    data-testid="did-not-hide"
                    title={hideOutcomeExplanation(row.hideOutcome) ?? undefined}
                    className="rounded bg-yellow-200 px-1.5 py-0.5 text-xs text-yellow-900"
                  >
                    did not hide
                  </span>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {row.reporterNickName ?? "Deleted reporter"} reported{" "}
                {row.authorNickName ?? "a deleted author"}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
              </p>
            </button>
          ))}

          <nav className="flex items-center justify-between pt-2 text-sm">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-muted-foreground">
              Page {page} of {total} report{total === 1 ? "" : "s"}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </nav>
        </section>

        <section className="flex flex-col gap-4">
          {!report && (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              Pick a report to see what was reported.
            </div>
          )}

          {report && (
            <>
              {!report.contentStillExists && (
                <div
                  data-testid="content-gone"
                  className="rounded-md border border-dashed p-4 text-sm text-muted-foreground"
                >
                  <TriangleAlert className="mb-1 inline size-4" /> The content is no longer
                  there, so only this snapshot remains. Upholding still records the strike.
                </div>
              )}

              <article className="rounded-md border p-4">
                <h2 className="text-sm font-semibold">Reported content</h2>
                <p
                  data-testid="content-snapshot"
                  className="mt-2 whitespace-pre-wrap text-sm"
                  onMouseEnter={() => setHasReadContent(true)}
                  onFocus={() => setHasReadContent(true)}
                  tabIndex={0}
                >
                  {report.contentSnapshot ?? "The snapshot was cleared with the author's account."}
                </p>
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
                  <p className="text-muted-foreground">
                    {report.authorNickName ?? "Deleted author"}
                  </p>
                  <p data-testid="author-strikes">
                    {detail?.authorStrikes ?? 0} strike
                    {detail?.authorStrikes === 1 ? "" : "s"}
                  </p>
                </article>

                <article className="rounded-md border p-4 text-sm">
                  <h2 className="font-semibold">Reporter</h2>
                  <p className="text-muted-foreground">
                    {report.reporterNickName ?? "Deleted reporter"}
                  </p>
                  <p data-testid="reporter-record">
                    {detail?.reporterTotal ?? 0} reports, {detail?.reporterDismissed ?? 0}{" "}
                    dismissed
                  </p>
                  <Badge variant="outline" data-testid="reporter-risk">
                    {riskLabel[risk]}
                  </Badge>
                  {report.reporterNote && (
                    <p className="mt-2 whitespace-pre-wrap">{report.reporterNote}</p>
                  )}
                </article>
              </div>

              {canDecide(report) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    data-testid="dismiss"
                    disabled={!dismissEnabled(report) || saving}
                    onClick={() => void decide("Dismiss")}
                  >
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    Nothing wrong, put it back
                  </Button>
                  <Button
                    variant="destructive"
                    data-testid="uphold"
                    disabled={!upholdEnabled(report, hasReadContent) || saving}
                    onClick={() => setConfirming(true)}
                  >
                    Breaks the rules, delete it
                  </Button>
                  {!hasReadContent && (
                    <span className="text-xs text-muted-foreground">
                      Read the content before deleting it.
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Decided {report.status.toLowerCase()} by {report.decidedBy ?? "unknown"}
                  {report.decidedAt ? ` on ${new Date(report.decidedAt).toLocaleString()}` : ""}.
                  {report.decisionNote ? ` ${report.decisionNote}` : ""}
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <Sheet open={confirming} onOpenChange={setConfirming}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Delete this content permanently?</SheetTitle>
            <SheetDescription data-testid="confirm-body">
              This deletes {report?.authorNickName ?? "the author"}
              {"'"}s {report?.contentType === "Review" ? "review" : "obstacle report"} for
              good. It cannot be undone. It becomes strike{" "}
              {strikeAfterUphold(detail?.authorStrikes ?? 0, false)} against them.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4">
            <Textarea
              data-testid="decision-note"
              placeholder="Why (optional)"
              value={decisionNote}
              onChange={(event) => setDecisionNote(event.target.value)}
            />
          </div>

          <SheetFooter>
            <Button
              variant="destructive"
              data-testid="confirm-uphold"
              disabled={saving}
              onClick={() => void decide("Uphold")}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Delete permanently
            </Button>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={option === value ? "default" : "ghost"}
          onClick={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}
