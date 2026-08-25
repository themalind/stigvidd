import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  confidenceOrder,
  decideBulk,
  getProposals,
  getSession,
  type Confidence,
  type Decision,
  type Proposal,
  type Session,
} from "@/api/trail-import";
import { getAllTrails } from "@/api/trail";
import type { TrailShortInfoResponse } from "@/types/types";
import {
  ConfidenceBadge,
  DecisionBadge,
  StatusBadge,
  decisionLabel,
} from "@/components/trail-import/badges";
import { ApplyPanel } from "@/components/trail-import/apply-panel";
import { ProposalDetail } from "@/components/trail-import/proposal-detail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

const PageSize = 50;

// Only these two are ever worth a batch: the ones the geometry settled by itself.
const bulkTiers: Confidence[] = ["Certain", "High"];

const decisionFilters: (Decision | "All")[] = [
  "All",
  "Pending",
  "Accept",
  "Relink",
  "CreateNew",
  "Exclude",
  "Skip",
];

function countFor(session: Session | null, confidence: Confidence): number {
  const counts = session?.counts;
  if (!counts) return 0;

  return (
    {
      Certain: counts.certain,
      High: counts.high,
      Medium: counts.medium,
      Unmatched: counts.unmatched,
    }[confidence] ?? 0
  );
}

export default function TrailImportReviewPage() {
  const { sessionId: sessionParam } = useParams();
  const sessionId = Number(sessionParam);

  const [session, setSession] = useState<Session | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [trails, setTrails] = useState<TrailShortInfoResponse[]>([]);
  const [confidence, setConfidence] = useState<Confidence | "All">("All");
  const [decision, setDecision] = useState<Decision | "All">("Pending");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Id to confidence, not a bare id set: selecting across pages means the row is no longer
  // in view when the batch is checked for whether it may be accepted.
  const [checked, setChecked] = useState<Map<number, string>>(new Map());
  const [selectingAll, setSelectingAll] = useState(false);
  const [shortcut, setShortcut] = useState<Decision | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  // An applied session is a record of what happened, not a queue: nothing on it can be
  // decided, and the server refuses the attempt, so the controls go rather than fail.
  const applied = session?.status === "Applied";

  const load = useCallback(async () => {
    try {
      const [loadedSession, paged] = await Promise.all([
        getSession(sessionId),
        getProposals(sessionId, {
          confidence: confidence === "All" ? undefined : confidence,
          decision: decision === "All" ? undefined : decision,
          page,
          pageSize: PageSize,
        }),
      ]);

      setSession(loadedSession);
      setProposals(paged.items ?? []);
      setTotal(paged.totalCount ?? 0);
      setHasMore(paged.hasMore ?? false);
      setChecked(new Map());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The session could not be loaded.",
      );
    }
  }, [sessionId, confidence, decision, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Pending is the right default while reviewing and shows an empty list afterwards.
  useEffect(() => {
    if (applied) setDecision((current) => (current === "Pending" ? "All" : current));
  }, [applied]);

  useEffect(() => {
    getAllTrails()
      .then(setTrails)
      .catch(() =>
        toast.error(
          "The trail list could not be loaded; relinking will have nothing to pick from.",
        ),
      );
  }, []);

  // Keep a row selected as the list changes, so the keyboard never lands on nothing.
  useEffect(() => {
    if (!proposals || proposals.length === 0) {
      setSelectedId(null);
      return;
    }

    setSelectedId((current) =>
      current !== null && proposals.some((p) => p.id === current)
        ? current
        : proposals[0].id,
    );
  }, [proposals]);

  const selected = useMemo(
    () => proposals?.find((proposal) => proposal.id === selectedId) ?? null,
    [proposals, selectedId],
  );

  const step = useCallback(
    (offset: number) => {
      if (!proposals || proposals.length === 0) return;

      const index = proposals.findIndex(
        (proposal) => proposal.id === selectedId,
      );
      const next = Math.min(Math.max(index + offset, 0), proposals.length - 1);
      setSelectedId(proposals[next].id);
    },
    [proposals, selectedId],
  );

  // 203 features go fast when the hand never leaves the keyboard. Typing in the note or
  // the trail search must not fire them.
  useEffect(() => {
    if (applied) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const shortcuts: Record<string, () => void> = {
        j: () => step(1),
        k: () => step(-1),
        a: () => setShortcut("Accept"),
        r: () => setShortcut("Relink"),
        n: () => setShortcut("CreateNew"),
        x: () => setShortcut("Exclude"),
        s: () => setShortcut("Skip"),
        u: () => setShortcut("Pending"),
      };

      const action = shortcuts[event.key.toLowerCase()];
      if (!action) return;

      event.preventDefault();
      action();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, applied]);

  function toggle(proposal: Proposal) {
    setChecked((current) => {
      const next = new Map(current);
      if (next.has(proposal.id)) next.delete(proposal.id);
      else next.set(proposal.id, proposal.confidence);
      return next;
    });
  }

  function togglePage() {
    if (!proposals) return;

    setChecked((current) => {
      const next = new Map(current);
      const allOn = proposals.every((proposal) => next.has(proposal.id));

      for (const proposal of proposals) {
        if (allOn) next.delete(proposal.id);
        else next.set(proposal.id, proposal.confidence);
      }

      return next;
    });
  }

  /** Every proposal matching the current filter, not just the page in view. */
  async function selectAllMatching() {
    setSelectingAll(true);
    try {
      const everything = new Map<number, string>();

      // Walked page by page: the API caps a page at 200, and the ids are what
      // decide-bulk needs.
      for (let cursor = 1; ; cursor++) {
        const paged = await getProposals(sessionId, {
          confidence: confidence === "All" ? undefined : confidence,
          decision: decision === "All" ? undefined : decision,
          page: cursor,
          pageSize: 200,
        });

        for (const proposal of paged.items ?? [])
          everything.set(proposal.id, proposal.confidence);

        if (!paged.hasMore) break;
      }

      setChecked(everything);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The selection could not be built.",
      );
    } finally {
      setSelectingAll(false);
    }
  }

  async function runBulk(bulkDecision: Decision) {
    setBulkSaving(true);
    try {
      const decided = await decideBulk(sessionId, {
        proposalIds: [...checked.keys()],
        decision: bulkDecision,
      });
      toast.success(`${decided} proposal(s) set to ${bulkDecision}.`);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The batch could not be decided.",
      );
    } finally {
      setBulkSaving(false);
    }
  }

  // The narrowing in words. Confidence and decision are combined, so a list can come back
  // short or empty because of a card the reviewer no longer has in mind.
  const narrowedBy = [
    confidence === "All" ? null : confidence,
    decision === "All" ? null : (decisionLabel[decision] ?? decision),
  ].filter((label): label is string => label !== null);

  const showAll = () => {
    setConfidence("All");
    setDecision("All");
    setPage(1);
  };

  const bulkable =
    checked.size > 0 &&
    [...checked.values()].every((tier) =>
      bulkTiers.includes(tier as Confidence),
    );

  const pageChecked =
    proposals?.filter((proposal) => checked.has(proposal.id)).length ?? 0;
  const wholePageChecked =
    proposals !== null &&
    proposals.length > 0 &&
    pageChecked === proposals.length;

  // Offered once the page is exhausted and the filter still holds more, the way a mail
  // client does it — otherwise "select all" quietly means "select these fifty".
  const canSelectAllMatching = wholePageChecked && total > checked.size;

  return (
    <main>
      <div className="container mx-auto space-y-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <NavLink to="/trail-import">
              <ArrowLeft />
              Sessions
            </NavLink>
          </Button>
          {session && (
            <>
              <h1 className="text-lg font-semibold">{session.fileName}</h1>
              <StatusBadge status={session.status} />
              <span className="text-xs text-muted-foreground">
                {session.featureCount} features · {session.source}
              </span>
            </>
          )}
        </div>

        {/* Summary row: what the analysis decided by itself, and what it left. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {confidenceOrder
            .slice()
            .reverse()
            .map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => {
                  setConfidence(confidence === tier ? "All" : tier);
                  setPage(1);
                }}
                className={`rounded-md border p-3 text-left transition-colors hover:bg-accent ${
                  confidence === tier ? "border-primary bg-accent" : ""
                }`}
              >
                <p className="text-2xl font-semibold tabular-nums">
                  {countFor(session, tier)}
                </p>
                <ConfidenceBadge confidence={tier} />
              </button>
            ))}
        </div>

        {session?.counts && (
          <p className="text-xs text-muted-foreground">
            {session.counts.pending} undecided · {session.counts.accepted}{" "}
            accepted · {session.counts.relinked} relinked ·{" "}
            {session.counts.createNew} new · {session.counts.excluded} excluded
            · {session.counts.skipped} skipped
          </p>
        )}

        {session && (
          <ApplyPanel
            session={session}
            onApplied={() => void load()}
            onShowCreated={() => {
              setDecision("CreateNew");
              setPage(1);
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {decisionFilters.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={decision === filter ? "default" : "outline"}
              onClick={() => {
                setDecision(filter);
                setPage(1);
              }}
            >
              {filter}
            </Button>
          ))}

          {!applied && checked.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {checked.size} selected
              </span>
              <Button
                size="sm"
                disabled={!bulkable || bulkSaving}
                title={
                  bulkable
                    ? "Accept every selected suggestion"
                    : "Batch accept is only for Certain and High — the rest need looking at"
                }
                onClick={() => void runBulk("Accept")}
              >
                {bulkSaving ? <Loader2 className="animate-spin" /> : null}
                Accept selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setChecked(new Map())}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {narrowedBy.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Showing {narrowedBy.join(" · ")}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={showAll}
            >
              Show all
            </Button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="space-y-1">
            {proposals === null && <Skeleton className="h-96 w-full" />}

            {proposals?.length === 0 && (
              <div className="space-y-3 rounded-md border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {narrowedBy.length === 2
                    ? `No proposal is both ${narrowedBy[0]} and ${narrowedBy[1]}.`
                    : narrowedBy.length === 1
                      ? `No proposal is ${narrowedBy[0]}.`
                      : "This session has no proposals."}
                </p>
                {narrowedBy.length > 0 && (
                  <Button variant="outline" size="sm" onClick={showAll}>
                    Show all
                  </Button>
                )}
              </div>
            )}

            {!applied && proposals !== null && proposals.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                <Checkbox
                  checked={
                    wholePageChecked
                      ? true
                      : pageChecked > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={togglePage}
                  aria-label="Select every proposal on this page"
                />
                <span className="text-xs text-muted-foreground">
                  {checked.size > 0
                    ? `${checked.size} selected`
                    : `Select all ${proposals.length} on this page`}
                </span>

                {canSelectAllMatching && (
                  <Button
                    size="sm"
                    variant="link"
                    className="h-auto p-0 text-xs"
                    disabled={selectingAll}
                    onClick={() => void selectAllMatching()}
                  >
                    {selectingAll ? <Loader2 className="animate-spin" /> : null}
                    Select all {total} matching
                  </Button>
                )}
              </div>
            )}

            <div className="max-h-[70vh] divide-y overflow-y-auto rounded-md border">
              {proposals?.map((proposal) => (
                <div
                  key={proposal.id}
                  className={`flex items-start gap-2 p-2 ${
                    proposal.id === selectedId
                      ? "bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  {!applied && (
                    <Checkbox
                      className="mt-1"
                      checked={checked.has(proposal.id)}
                      onCheckedChange={() => toggle(proposal)}
                      aria-label={`Select ${proposal.featureName}`}
                    />
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedId(proposal.id)}
                  >
                    <p className="truncate text-sm font-medium">
                      {proposal.featureName || "(no name in source)"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {/* Without a suggestion the coverage numbers say nothing on their own;
                          the nearest trail is what they were measured against. */}
                      {proposal.suggestedTrailName ??
                        (proposal.nearestTrailName
                          ? `nearest: ${proposal.nearestTrailName}`
                          : "no trail suggested")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <ConfidenceBadge confidence={proposal.confidence} />
                      {proposal.decision !== "Pending" && (
                        <DecisionBadge decision={proposal.decision} />
                      )}
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {Math.round((proposal.coverageForward ?? 0) * 100)}/
                        {Math.round((proposal.coverageBackward ?? 0) * 100)}%
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <span>
                {total === 0
                  ? "0"
                  : `${(page - 1) * PageSize + 1}–${(page - 1) * PageSize + (proposals?.length ?? 0)}`}{" "}
                of {total}
              </span>
              <span className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!hasMore}
                  onClick={() => setPage((current) => current + 1)}
                >
                  <ChevronRight />
                </Button>
              </span>
            </div>

            {!applied && (
            <p className="pt-2 text-xs text-muted-foreground">
              <kbd className="rounded border px-1">j</kbd>/
              <kbd className="rounded border px-1">k</kbd> step ·{" "}
              <kbd className="rounded border px-1">a</kbd> accept ·{" "}
              <kbd className="rounded border px-1">r</kbd> relink ·{" "}
              <kbd className="rounded border px-1">n</kbd> new ·{" "}
              <kbd className="rounded border px-1">x</kbd> exclude ·{" "}
              <kbd className="rounded border px-1">s</kbd> skip ·{" "}
              <kbd className="rounded border px-1">u</kbd> undo
            </p>
            )}
          </div>

          <div className="rounded-md border p-4">
            {selected ? (
              <ProposalDetail
                sessionId={sessionId}
                proposal={selected}
                trails={trails}
                readOnly={applied}
                // Move on first: with the Pending filter the decided row leaves the list,
                // and without this the selection would fall back to the top of it.
                onDecided={() => {
                  step(1);
                  void load();
                }}
                pendingShortcut={shortcut}
                onShortcutHandled={() => setShortcut(null)}
              />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Pick a feature to review it.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
