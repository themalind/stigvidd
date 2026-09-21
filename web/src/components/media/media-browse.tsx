// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "radix-ui";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getMedia, updateImageMetadata, type ReprocessJobSummary } from "@/api/media";
import { deleteTrailImage } from "@/api/trail";
import { deleteFacilityImage } from "@/api/facility";
import MediaReprocessDialog from "./media-reprocess-dialog";
import type { MediaItemResponse } from "@/api/generated/model";
import {
  MEDIA_SORTS,
  MediaPageSize,
  canSelectAllMatching,
  describeMediaFilters,
  emptyMediaFilters,
  isFiltered,
  pageSelection,
  selectableMedia,
  toMediaFilter,
  toMediaQuery,
  togglePageSelection,
  wouldBeChangedBy,
  type MediaFilterState,
  type MediaSortValue,
} from "@/lib/media-browse";
import { formatBytes } from "@/lib/format";
import { NEEDS_WORK_PRESET, presetByKey } from "@/lib/media-reprocess";
import type { ReprocessTarget } from "@/lib/media-reprocess-target";

const OWNER_TYPES = ["All", "Trail", "Facility", "TrailSymbol"];
const FORMATS = ["All", "jpeg", "png", "webp"];

interface Props {
  refreshKey: number;
  onBatchStarted?: (job: ReprocessJobSummary) => void;
}

export default function MediaBrowse({ refreshKey, onBatchStarted }: Props) {
  const [items, setItems] = useState<MediaItemResponse[] | null>(null);
  const [filters, setFilters] = useState<MediaFilterState>(emptyMediaFilters);
  const [draft, setDraft] = useState<MediaFilterState>(emptyMediaFilters);
  const [showMore, setShowMore] = useState(false);
  const [page, setPage] = useState(1);
  // keep-comment: separate from filters - a new sort shows the same images in another order, so it rewinds to page 1 but must NOT drop a selection the operator has already made
  const [sort, setSort] = useState<MediaSortValue>("newest");
  const [total, setTotal] = useState(0);
  const [reprocessable, setReprocessable] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [enlarged, setEnlarged] = useState<MediaItemResponse | null>(null);
  const [editing, setEditing] = useState<MediaItemResponse | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  const [reprocessOpen, setReprocessOpen] = useState(false);

  const preset = presetByKey(NEEDS_WORK_PRESET);
  const query = useMemo(() => toMediaQuery(filters, preset), [filters, preset]);

  // keep-comment: isCurrent, because nothing cancels an in-flight request - two loads overlap whenever a filter and the page change together, and without this the slower one wins and the grid disagrees with the pager
  const load = useCallback(
    async (isCurrent: () => boolean) => {
      try {
        const paged = await getMedia({ ...query, Sort: sort, Page: page, PageSize: MediaPageSize });
        if (!isCurrent()) return;

        setItems(paged.items);
        setTotal(paged.totalCount ?? 0);
        setReprocessable(paged.reprocessableCount ?? 0);
        setTotalBytes(paged.totalSizeBytes ?? 0);
        setHasMore(paged.hasMore ?? false);
      } catch (error) {
        if (!isCurrent()) return;

        setItems([]);
        toast.error(
          error instanceof Error ? error.message : "The media library could not be loaded.",
        );
      }
    },
    [query, sort, page],
  );

  useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, [load, refreshKey]);

  const selection = pageSelection(selected, items);
  const selectAllOffered = canSelectAllMatching(selection, reprocessable, selected, allMatching);
  const narrowedBy = describeMediaFilters(filters);
  const selectableCount = selectableMedia(items ?? []).length;

  // keep-comment: reset here rather than in an effect on [filters] - an effect runs AFTER the load effect has already fired with the new filter and the old page, so the narrower result is fetched twice and the stale page can land second
  function refilter() {
    setPage(1);
    setSelected(new Set());
    setAllMatching(false);
  }

  function applyChip(patch: Partial<MediaFilterState>) {
    setFilters((current) => ({ ...current, ...patch }));
    setDraft((current) => ({ ...current, ...patch }));
    refilter();
  }

  function showAll() {
    setFilters(emptyMediaFilters);
    setDraft(emptyMediaFilters);
    refilter();
  }

  function toggleSelected(identifier: string, checked: boolean) {
    setAllMatching(false);
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(identifier);
      else next.delete(identifier);
      return next;
    });
  }

  function togglePage() {
    if (!items) return;
    setAllMatching(false);
    setSelected((current) => togglePageSelection(current, items));
  }

  function openEdit(item: MediaItemResponse) {
    setEditing(item);
    setAltText(item.altText ?? "");
    setCaption(item.caption ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateImageMetadata(editing.identifier, { altText, caption });
      setItems((prev) =>
        (prev ?? []).map((i) =>
          i.identifier === editing.identifier ? { ...i, altText, caption } : i,
        ),
      );
      setEditing(null);
      toast.success("Metadata saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The metadata could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: MediaItemResponse) {
    if (item.ownerType === "TrailSymbol") return;
    if (!confirm("Delete this image? This cannot be undone.")) return;

    try {
      if (item.ownerType === "Trail") await deleteTrailImage(item.identifier);
      else if (item.ownerType === "Facility") await deleteFacilityImage(item.identifier);

      setSelected((current) => {
        const next = new Set(current);
        next.delete(item.identifier);
        return next;
      });

      // keep-comment: a reload rather than dropping the row locally - the totals, the size and the "select all matching" offer are all server counts, and a page short of one row also hides whatever would have moved up into it
      await load(() => true);
      toast.success("Image deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The image could not be deleted.");
    }
  }

  function handleBatchSubmitted(job: ReprocessJobSummary) {
    setSelected(new Set());
    setAllMatching(false);
    setReprocessOpen(false);
    onBatchStarted?.(job);
  }

  const target: ReprocessTarget = allMatching
    ? {
        kind: "filter",
        filter: toMediaFilter(filters, preset),
        matchingCount: reprocessable,
        summary: narrowedBy.length > 0 ? narrowedBy.join(" · ") : "the whole library",
      }
    : { kind: "ids", mediaIdentifiers: [...selected] };

  const from = (page - 1) * MediaPageSize + 1;
  const to = (page - 1) * MediaPageSize + (items?.length ?? 0);

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant={filters.needsWork ? "default" : "outline"}
            aria-pressed={filters.needsWork}
            onClick={() => applyChip({ needsWork: !filters.needsWork })}
          >
            <TriangleAlert className="size-3.5" />
            Needs work
          </Button>

          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Owner</span>
            {OWNER_TYPES.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={option === filters.ownerType ? "default" : "ghost"}
                onClick={() => applyChip({ ownerType: option })}
              >
                {option === "TrailSymbol" ? "Symbols" : option}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Format</span>
            {FORMATS.map((option) => (
              <Button
                key={option}
                size="sm"
                variant={option === filters.format ? "default" : "ghost"}
                onClick={() => applyChip({ format: option })}
              >
                {option === "All" ? "All" : option.toUpperCase()}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-sm">
            <label className="text-muted-foreground" htmlFor="media-sort">
              Sort
            </label>
            <select
              id="media-sort"
              className="border-input bg-background h-8 rounded-md border px-2 text-sm"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as MediaSortValue);
                setPage(1);
              }}
            >
              {MEDIA_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button size="sm" variant="outline" onClick={() => setShowMore((v) => !v)}>
            {showMore ? "Fewer filters" : "More filters"}
          </Button>
        </div>

        {showMore && (
          <form
            className="grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters(draft);
              refilter();
            }}
          >
            <NumberRange
              label="Width (px)"
              minLabel="Minimum width"
              maxLabel="Maximum width"
              min={draft.minWidth}
              max={draft.maxWidth}
              onMin={(v) => setDraft({ ...draft, minWidth: v })}
              onMax={(v) => setDraft({ ...draft, maxWidth: v })}
            />
            <NumberRange
              label="Height (px)"
              minLabel="Minimum height"
              maxLabel="Maximum height"
              min={draft.minHeight}
              max={draft.maxHeight}
              onMin={(v) => setDraft({ ...draft, minHeight: v })}
              onMax={(v) => setDraft({ ...draft, maxHeight: v })}
            />
            <NumberRange
              label="Size (KB)"
              minLabel="Minimum size in KB"
              maxLabel="Maximum size in KB"
              min={draft.minSizeKb}
              max={draft.maxSizeKb}
              onMin={(v) => setDraft({ ...draft, minSizeKb: v })}
              onMax={(v) => setDraft({ ...draft, maxSizeKb: v })}
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Uploaded</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  aria-label="Uploaded from"
                  className="h-8"
                  value={draft.uploadedFrom}
                  onChange={(e) => setDraft({ ...draft, uploadedFrom: e.target.value })}
                />
                <Input
                  type="date"
                  aria-label="Uploaded to"
                  className="h-8"
                  value={draft.uploadedTo}
                  onChange={(e) => setDraft({ ...draft, uploadedTo: e.target.value })}
                />
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button size="sm" type="submit">
                Apply filters
              </Button>
            </div>
          </form>
        )}

        {narrowedBy.length > 0 && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
            <span>Showing: {narrowedBy.join(" · ")}</span>
            <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={showAll}>
              Show all
            </Button>
          </div>
        )}

        <div className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5">
          {allMatching ? (
            <>
              <span className="text-sm">
                All {reprocessable} image(s) matching this filter are selected.
              </span>
              <Button
                size="sm"
                variant="link"
                className="h-auto p-0 text-xs"
                onClick={() => setAllMatching(false)}
              >
                Select just this page instead
              </Button>
            </>
          ) : (
            <>
              <Checkbox
                checked={selection.whole ? true : selection.onPage > 0 ? "indeterminate" : false}
                onCheckedChange={togglePage}
                disabled={selectableCount === 0}
                aria-label="Select every image on this page"
              />
              <span className="text-muted-foreground text-xs">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `Select all ${selectableCount} on this page`}
              </span>
              {selectAllOffered && (
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() => setAllMatching(true)}
                >
                  Select all {reprocessable} matching this filter
                </Button>
              )}
            </>
          )}

          <Button
            size="sm"
            className="ml-auto"
            disabled={allMatching ? reprocessable === 0 : selected.size === 0}
            onClick={() => setReprocessOpen(true)}
          >
            Optimize {allMatching ? reprocessable : selected.size || ""}
          </Button>
        </div>

        {items === null && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        )}

        {items?.length === 0 && (
          <div className="text-muted-foreground rounded-md border border-dashed p-6 text-sm">
            {isFiltered(filters)
              ? `No images match ${narrowedBy.join(" · ")}.`
              : "No media yet. Upload some images from the Upload tab."}
          </div>
        )}

        {items !== null && items.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const editable = item.ownerType !== "TrailSymbol";
              return (
                <div
                  key={`${item.ownerType}-${item.identifier}`}
                  className="group overflow-hidden rounded-xs border"
                >
                  <div className="relative aspect-square overflow-hidden">
                    {/* keep-comment: there is no thumbnail anywhere in this system - every cell is the full-resolution original, so a page of 48 is 48 full downloads without these attributes */}
                    <img
                      src={item.imageUrl}
                      alt={item.altText ?? ""}
                      loading="lazy"
                      decoding="async"
                      width={item.width || undefined}
                      height={item.height || undefined}
                      className="h-full w-full cursor-pointer object-cover"
                      onClick={() => setEnlarged(item)}
                    />
                    {editable && (
                      <div className="absolute top-1 left-1">
                        <Checkbox
                          checked={allMatching || selected.has(item.identifier)}
                          disabled={allMatching}
                          onCheckedChange={(c) => toggleSelected(item.identifier, c === true)}
                          className="bg-background/80"
                          aria-label={`Select ${item.ownerName ?? item.identifier}`}
                        />
                      </div>
                    )}
                    {wouldBeChangedBy(item, preset) && (
                      <span
                        role="img"
                        aria-label={`Would be changed by ${preset.label}`}
                        title="Larger than the preset or not its format — the preset would change this image"
                        className="bg-background/80 absolute bottom-1 left-1 rounded-full p-0.5"
                      >
                        <TriangleAlert className="size-3 text-amber-500" />
                      </span>
                    )}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      {editable && (
                        <button
                          onClick={() => openEdit(item)}
                          className="bg-background/80 hover:bg-background rounded-xs p-1"
                          title="Edit metadata"
                          aria-label={`Edit metadata for ${item.ownerName ?? item.identifier}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                      {editable && (
                        <button
                          onClick={() => handleDelete(item)}
                          className="bg-background/80 hover:bg-background rounded-xs p-1"
                          title="Delete"
                          aria-label={`Delete ${item.ownerName ?? item.identifier}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 p-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {item.ownerType}
                      </Badge>
                      <span className="text-muted-foreground truncate text-xs">
                        {item.ownerName}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
                      {formatBytes(item.sizeBytes)}
                      {item.format ? ` · ${item.format.toUpperCase()}` : ""}
                    </p>
                    {item.createdAt && (
                      <p
                        className="text-muted-foreground text-[10px]"
                        title={new Date(item.createdAt).toLocaleString()}
                      >
                        {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-muted-foreground flex items-center justify-between gap-4 text-xs">
          <span>
            {total === 0 ? "No images" : `${from}–${to} of ${total}`}
            {totalBytes > 0 ? ` · ${formatBytes(totalBytes)}` : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              data-testid="previous-page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!hasMore}
              data-testid="next-page"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Edit metadata dialog */}
      <Dialog.Root
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xs border p-6 shadow-lg">
            <Dialog.Title className="font-semibold">Edit metadata</Dialog.Title>
            <Dialog.Description className="text-muted-foreground text-sm">
              Alt text and caption for this image.
            </Dialog.Description>
            <div className="space-y-1.5">
              <Label htmlFor="alt">Alt text</Label>
              <Input
                id="alt"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe the image for accessibility"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="caption">Caption</Label>
              <Textarea
                id="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Optional caption"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.Close>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Enlarge */}
      {enlarged && (
        <Dialog.Root open onOpenChange={(open) => !open && setEnlarged(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-60 bg-black/80" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-60 -translate-x-1/2 -translate-y-1/2 outline-none">
              <Dialog.Title className="sr-only">Enlarged image</Dialog.Title>
              <Dialog.Description className="sr-only">
                Full-size view of the selected image.
              </Dialog.Description>
              <img
                src={enlarged.imageUrl}
                alt={enlarged.altText ?? ""}
                decoding="async"
                className="max-h-[85vh] max-w-[85vw] rounded-xs object-contain shadow-2xl"
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {reprocessOpen && (
        <MediaReprocessDialog
          open
          onOpenChange={setReprocessOpen}
          target={target}
          onSubmitted={handleBatchSubmitted}
        />
      )}
    </>
  );
}

function NumberRange({
  label,
  minLabel,
  maxLabel,
  min,
  max,
  onMin,
  onMax,
}: {
  label: string;
  minLabel: string;
  maxLabel: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          aria-label={minLabel}
          placeholder="min"
          className="h-8"
          value={min}
          onChange={(e) => onMin(e.target.value)}
        />
        <Input
          type="number"
          min={0}
          aria-label={maxLabel}
          placeholder="max"
          className="h-8"
          value={max}
          onChange={(e) => onMax(e.target.value)}
        />
      </div>
    </div>
  );
}
