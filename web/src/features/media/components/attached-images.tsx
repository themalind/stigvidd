// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils/format";
import type { MediaItemResponse } from "@/api/generated/model";
import { ownerMediaQueryOptions, useDeleteImage } from "@/features/media/api/media";
import { attachedTo, type TargetType } from "@/features/media/utils/media-upload";

interface Props {
  targetType: TargetType;
  targetId: string;
  onTrailImagesChanged: () => void;
}

export function AttachedImages({ targetType, targetId, onTrailImagesChanged }: Props) {
  const { data, isError, refetch } = useQuery(ownerMediaQueryOptions(targetId));
  const deleteImage = useDeleteImage(onTrailImagesChanged);
  const isSymbol = targetType === "trail-symbol";
  const existing = data ? attachedTo(data, targetId, targetType) : undefined;

  function handleDelete(item: MediaItemResponse) {
    if (!confirm("Delete this image?")) return;
    deleteImage.mutate(item);
  }

  return (
    <div className="space-y-2">
      <Label>
        {isSymbol ? "Current symbol" : "Existing images"}
        {existing && existing.length > 0 && (
          <span className="text-muted-foreground font-normal">&nbsp;({existing.length})</span>
        )}
      </Label>
      {isError ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>The existing images could not be loaded.</span>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : existing === undefined ? (
        <p className="text-muted-foreground text-xs">Loading…</p>
      ) : existing.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {isSymbol ? "No symbol set yet." : "No images attached yet — the ones you upload will show up here."}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {existing.map((item) => {
            const deleting = deleteImage.isPending && deleteImage.variables.identifier === item.identifier;
            return (
              <div
                key={`${item.ownerType}-${item.identifier}`}
                className="group relative aspect-square overflow-hidden rounded-xs border"
              >
                <img
                  src={item.imageUrl}
                  alt={item.altText ?? ""}
                  className={cn("h-full w-full", isSymbol ? "bg-muted object-contain p-2" : "object-cover")}
                />
                {!isSymbol && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deleting}
                    title="Delete image"
                    className={cn(
                      "bg-background/80 hover:bg-background absolute top-1 right-1 rounded-xs p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
                      deleting && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
                {item.width > 0 && item.height > 0 && (
                  <span className="bg-background/80 absolute right-0 bottom-0 left-0 truncate px-1 py-0.5 text-[10px]">
                    {item.width}×{item.height} · {formatBytes(item.sizeBytes)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isSymbol && existing && existing.length > 0 && (
        <p className="text-muted-foreground text-xs">Uploading a new symbol replaces the current one.</p>
      )}
    </div>
  );
}
