// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConfirm } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/error-state";
import { ImageLightbox } from "@/components/image-lightbox";
import { Pager } from "@/components/pager";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchState } from "@/hooks/use-search-state";
import type { MediaItemResponse } from "@/api/generated/model";
import { mediaLibraryQueryOptions, useDeleteImage, type ReprocessJobSummary } from "@/features/media/api/media";
import {
  canSelectAllMatching,
  describeMediaFilters,
  emptyMediaFilters,
  isFiltered,
  MEDIA_SORTS,
  MediaPageSize,
  pageSelection,
  selectableMedia,
  toMediaFilter,
  toMediaQuery,
  togglePageSelection,
  type MediaFilterState,
  type MediaSortValue,
} from "@/features/media/utils/media-browse";
import { formatBytes } from "@/utils/format";
import { NEEDS_WORK_PRESET, presetByKey } from "@/features/media/utils/media-reprocess";
import type { ReprocessTarget } from "@/features/media/utils/media-reprocess-target";
import { EditMetadataDialog } from "./edit-metadata-dialog";
import { MediaCard } from "./media-card";
import { MediaFilters } from "./media-filters";
import MediaReprocessDialog from "./media-reprocess-dialog";
import { MediaSelectionBar } from "./media-selection-bar";

const preset = presetByKey(NEEDS_WORK_PRESET);

interface Props {
  onTrailImagesChanged: () => void;
  onBatchStarted: (job: ReprocessJobSummary) => void;
}

const SEARCH_DEFAULTS: Record<keyof MediaFilterState | "sort", string> = {
  ...emptyMediaFilters,
  needsWork: "",
  sort: "newest",
};

function useBrowseSearch() {
  const { values, page, update, setPage } = useSearchState(SEARCH_DEFAULTS);
  const { sort, needsWork, ...rest } = values;
  const filters: MediaFilterState = { ...rest, needsWork: needsWork === "true" };
  const knownSort = MEDIA_SORTS.find((option) => option.value === sort)?.value ?? "newest";

  return { filters, sort: knownSort, page, setPage, update };
}

export default function MediaBrowse({ onTrailImagesChanged, onBatchStarted }: Props) {
  const { filters, sort, page, setPage, update } = useBrowseSearch();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [enlarged, setEnlarged] = useState<MediaItemResponse | null>(null);
  const [editing, setEditing] = useState<MediaItemResponse | null>(null);
  const [reprocessOpen, setReprocessOpen] = useState(false);

  const library = useQuery(
    mediaLibraryQueryOptions({ ...toMediaQuery(filters, preset), Sort: sort, Page: page, PageSize: MediaPageSize }),
  );
  const deleteImage = useDeleteImage(onTrailImagesChanged);
  const [confirm, confirmDialog] = useConfirm();

  const items = library.data?.items;
  const total = library.data?.totalCount ?? 0;
  const reprocessable = library.data?.reprocessableCount ?? 0;
  const selection = pageSelection(selected, items ?? null);
  const narrowedBy = describeMediaFilters(filters);

  function clearSelection() {
    setSelected(new Set());
    setAllMatching(false);
  }

  function changeFilters(next: MediaFilterState) {
    update(next);
    clearSelection();
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

  async function handleDelete(item: MediaItemResponse) {
    const sure = await confirm({
      title: "Delete this image?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!sure) return;
    deleteImage.mutate(item, { onSuccess: () => toggleSelected(item.identifier, false) });
  }

  function handleBatchSubmitted(job: ReprocessJobSummary) {
    clearSelection();
    onBatchStarted(job);
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
    <div className="space-y-3">
      {confirmDialog}
      <MediaFilters
        filters={filters}
        onFiltersChange={changeFilters}
        sort={sort}
        // keep-comment: a new sort shows the same images in another order, so it rewinds to page 1 but keeps the selection
        onSortChange={(next: MediaSortValue) => update({ sort: next })}
      />

      <MediaSelectionBar
        selection={selection}
        selectedCount={selected.size}
        selectableCount={selectableMedia(items ?? []).length}
        reprocessable={reprocessable}
        allMatching={allMatching}
        offerAllMatching={canSelectAllMatching(selection, reprocessable, selected, allMatching)}
        onTogglePage={() => {
          setAllMatching(false);
          setSelected((current) => togglePageSelection(current, items ?? []));
        }}
        onAllMatchingChange={setAllMatching}
        onOptimize={() => setReprocessOpen(true)}
      />

      {library.isError ? (
        <ErrorState
          message={library.error instanceof Error ? library.error.message : "The media library could not be loaded."}
          onRetry={() => void library.refetch()}
        />
      ) : items === undefined ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground rounded-xs border border-dashed p-6 text-sm">
          {isFiltered(filters)
            ? `No images match ${narrowedBy.join(" · ")}.`
            : "No media yet. Upload some images from the Upload tab."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <MediaCard
              key={`${item.ownerType}-${item.identifier}`}
              item={item}
              preset={preset}
              checked={allMatching || selected.has(item.identifier)}
              selectionLocked={allMatching}
              onCheckedChange={(checked) => toggleSelected(item.identifier, checked)}
              onEnlarge={() => setEnlarged(item)}
              onEdit={() => setEditing(item)}
              onDelete={() => handleDelete(item)}
            />
          ))}
        </div>
      )}

      <Pager
        page={page}
        hasMore={library.data?.hasMore ?? false}
        busy={library.isPlaceholderData}
        onChange={setPage}
        summary={
          <>
            {total === 0 ? "No images" : `${from}–${to} of ${total}`}
            {library.data && library.data.totalSizeBytes > 0 ? ` · ${formatBytes(library.data.totalSizeBytes)}` : ""}
          </>
        }
      />

      {editing && <EditMetadataDialog key={editing.identifier} item={editing} onClose={() => setEditing(null)} />}

      <ImageLightbox image={enlarged} onClose={() => setEnlarged(null)} />

      {reprocessOpen && (
        <MediaReprocessDialog open onOpenChange={setReprocessOpen} target={target} onSubmitted={handleBatchSubmitted} />
      )}
    </div>
  );
}
