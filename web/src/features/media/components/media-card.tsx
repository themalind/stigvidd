// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Pencil, Trash2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBytes } from "@/utils/format";
import type { MediaItemResponse } from "@/api/generated/model";
import { mediaLabel, wouldBeChangedBy } from "@/features/media/utils/media-browse";
import type { ReprocessPreset } from "@/features/media/utils/media-reprocess";

interface Props {
  item: MediaItemResponse;
  preset: ReprocessPreset;
  checked: boolean;
  selectionLocked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onEnlarge: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MediaCard({
  item,
  preset,
  checked,
  selectionLocked,
  onCheckedChange,
  onEnlarge,
  onEdit,
  onDelete,
}: Props) {
  const editable = item.ownerType !== "TrailSymbol";
  const label = mediaLabel(item);

  return (
    <div className="group overflow-hidden rounded-xs border">
      <div className="relative aspect-square overflow-hidden">
        {/* keep-comment: there is no thumbnail anywhere in this system - every cell is the full-resolution original, so a page of 48 is 48 full downloads without these attributes */}
        <button
          type="button"
          className="block h-full w-full cursor-pointer"
          aria-label={`Enlarge ${label}`}
          onClick={onEnlarge}
        >
          <img
            src={item.imageUrl}
            alt={item.altText ?? ""}
            loading="lazy"
            decoding="async"
            width={item.width || undefined}
            height={item.height || undefined}
            className="h-full w-full object-cover"
          />
        </button>
        {editable && (
          <div className="absolute top-1 left-1">
            <Checkbox
              checked={checked}
              disabled={selectionLocked}
              onCheckedChange={(c) => onCheckedChange(c === true)}
              className="bg-background/80"
              aria-label={`Select ${label}`}
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
        {editable && (
          <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              className="bg-background/80 hover:bg-background rounded-xs p-1"
              title="Edit metadata"
              aria-label={`Edit metadata for ${label}`}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="bg-background/80 hover:bg-background rounded-xs p-1"
              title="Delete"
              aria-label={`Delete ${label}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {item.ownerType}
          </Badge>
          <span className="text-muted-foreground truncate text-xs">{item.ownerName}</span>
        </div>
        <p className="text-muted-foreground text-[11px]">
          {item.width && item.height ? `${item.width}×${item.height} · ` : ""}
          {formatBytes(item.sizeBytes)}
          {item.format ? ` · ${item.format.toUpperCase()}` : ""}
        </p>
        <p className="text-muted-foreground text-[10px]" title={new Date(item.createdAt).toLocaleString()}>
          {new Date(item.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
