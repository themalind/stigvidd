// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState } from "@/components/error-state";
import { ImageLightbox } from "@/components/image-lightbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MediaItemResponse } from "@/api/generated/model";
import { mediaLibraryQueryOptions, useDeleteImage, type ReprocessJobSummary } from "@/features/media/api/media";
import {
  canSelectAllMatching,
  describeMediaFilters,
  emptyMediaFilters,
  isFiltered,
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

export default function MediaBrowse({ onTrailImagesChanged, onBatchStarted }: Props) {
  const [filters, setFilters] = useState<MediaFilterState>(emptyMediaFilters);
  // keep-comment: separate from filters - a new sort shows the same images in another order, so it rewinds to page 1 but must NOT drop a selection the operator has already made
  const [sort, setSort] = useState<MediaSortValue>("newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [enlarged, setEnlarged] = useState<MediaItemResponse | null>(null);
  const [editing, setEditing] = useState<MediaItemResponse | null>(null);
  const [reprocessOpen, setReprocessOpen] = useState(false);

  const library = useQuery(
    mediaLibraryQueryOptions({ ...toMediaQuery(filters, preset), Sort: sort, Page: page, PageSize: MediaPageSize }),
  );
  const deleteImage = useDeleteImage(onTrailImagesChanged);

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
    setFilters(next);
    setPage(1);
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

  function handleDelete(item: MediaItemResponse) {
    if (!confirm("Delete this image? This cannot be undone.")) return;
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
      <MediaFilters
        filters={filters}
        onFiltersChange={changeFilters}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
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

      <div className="text-muted-foreground flex items-center justify-between gap-4 text-xs">
        <span>
          {total === 0 ? "No images" : `${from}–${to} of ${total}`}
          {library.data && library.data.totalSizeBytes > 0 ? ` · ${formatBytes(library.data.totalSizeBytes)}` : ""}
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
            disabled={!library.data?.hasMore || library.isPlaceholderData}
            data-testid="next-page"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {editing && <EditMetadataDialog key={editing.identifier} item={editing} onClose={() => setEditing(null)} />}

      <ImageLightbox image={enlarged} onClose={() => setEnlarged(null)} />

      {reprocessOpen && (
        <MediaReprocessDialog open onOpenChange={setReprocessOpen} target={target} onSubmitted={handleBatchSubmitted} />
      )}
    </div>
  );
}
