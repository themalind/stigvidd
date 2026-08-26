// The rules the import review runs on, kept out of the page so they can be tested without
// a browser. Everything here is pure except `collectAllMatching`, which is given the
// fetcher rather than reaching for one.
//
// These are the guard rails between a reviewer and an irreversible write: which selections
// may be batch-decided, and whether "select all" really means all of them.
import type { Confidence } from "@/api/trail-import";

/**
 * Proposal id to its confidence tier — not a bare id set, because selecting across pages
 * means the row is no longer in view when the batch is checked for whether it may be
 * accepted.
 */
export type CheckedProposals = ReadonlyMap<number, string>;

/** All the selection rules need from a proposal. */
export type SelectableProposal = { id: number; confidence: string };

// Only these two are ever worth a batch: the ones the geometry settled by itself.
export const bulkTiers: Confidence[] = ["Certain", "High"];

/**
 * A batch may only be decided when every row in it was settled by the geometry. One
 * `Medium` in the selection is enough to refuse — those are the ones that wanted a human.
 */
export function canBulkDecide(checked: CheckedProposals): boolean {
  return (
    checked.size > 0 &&
    [...checked.values()].every((tier) => bulkTiers.includes(tier as Confidence))
  );
}

export function toggleProposal(
  checked: CheckedProposals,
  proposal: SelectableProposal,
): Map<number, string> {
  const next = new Map(checked);

  if (next.has(proposal.id)) next.delete(proposal.id);
  else next.set(proposal.id, proposal.confidence);

  return next;
}

/** All-or-nothing for the page in view, leaving selections made on other pages alone. */
export function togglePageSelection(
  checked: CheckedProposals,
  proposals: readonly SelectableProposal[],
): Map<number, string> {
  const next = new Map(checked);
  const allOn = proposals.every((proposal) => next.has(proposal.id));

  for (const proposal of proposals) {
    if (allOn) next.delete(proposal.id);
    else next.set(proposal.id, proposal.confidence);
  }

  return next;
}

export type PageSelection = { onPage: number; whole: boolean };

export function pageSelection(
  checked: CheckedProposals,
  proposals: readonly SelectableProposal[] | null,
): PageSelection {
  if (proposals === null) return { onPage: 0, whole: false };

  const onPage = proposals.filter((proposal) => checked.has(proposal.id)).length;

  return { onPage, whole: proposals.length > 0 && onPage === proposals.length };
}

/**
 * Offered once the page is exhausted and the filter still holds more, the way a mail
 * client does it — otherwise "select all" quietly means "select these fifty".
 */
export function canSelectAllMatching(
  page: PageSelection,
  total: number,
  checked: CheckedProposals,
): boolean {
  return page.whole && total > checked.size;
}

export type ConfidenceCounts = {
  certain?: number;
  high?: number;
  medium?: number;
  unmatched?: number;
} | null;

export function countFor(
  counts: ConfidenceCounts | undefined,
  confidence: Confidence,
): number {
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

export type ProposalPage = {
  items?: SelectableProposal[];
  hasMore?: boolean;
};

/**
 * Complete carries the selection; incomplete carries nothing at all. A selection that
 * stopped short but looks whole is the failure this exists to prevent — the reviewer would
 * batch-decide a subset believing it was everything.
 */
export type CollectOutcome =
  | { complete: true; checked: Map<number, string> }
  | { complete: false; pagesWalked: number };

/**
 * Every proposal matching the current filter, not just the page in view. The walk's only
 * natural exit is the server saying there is no more, so `maxPages` is what stops a server
 * that always says there is from spinning in the browser forever.
 */
export async function collectAllMatching(
  fetchPage: (page: number) => Promise<ProposalPage>,
  maxPages: number,
): Promise<CollectOutcome> {
  const checked = new Map<number, string>();

  for (let cursor = 1; cursor <= maxPages; cursor++) {
    const paged = await fetchPage(cursor);

    for (const proposal of paged.items ?? [])
      checked.set(proposal.id, proposal.confidence);

    if (!paged.hasMore) return { complete: true, checked };
  }

  return { complete: false, pagesWalked: maxPages };
}
