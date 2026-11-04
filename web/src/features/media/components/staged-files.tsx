// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/utils/format";
import type { CropRect } from "@/features/media/utils/media-upload";
import ImageCrop from "./image-crop";

interface Props {
  files: File[];
  single: boolean;
  onAdd: (incoming: FileList | File[]) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
  onCropChange: (crop: CropRect | null) => void;
}

export function StagedFiles({ files, single, onAdd, onRemove, onClear, onCropChange }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          onAdd(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xs border-2 border-dashed p-8 text-center transition-colors",
          dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/40 hover:border-muted-foreground",
        )}
      >
        <p className="text-sm font-medium">Drop image{single ? "" : "s"} here or click to browse</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {single ? "One image for the trail symbol." : "PNG, JPEG, WebP…"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={!single}
          aria-label="Choose images"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {previews.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <Label>
              Staged for upload
              <span className="text-muted-foreground font-normal">&nbsp;({previews.length})</span>
            </Label>
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {previews.map((p, i) => (
              <div key={p.url} className="group relative aspect-square overflow-hidden rounded-xs border">
                <img src={p.url} alt="" className="h-full w-full object-cover" />
                <span className="bg-background/80 absolute right-0 bottom-0 left-0 truncate px-1 py-0.5 text-[10px]">
                  {formatBytes(p.file.size)}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${p.file.name}`}
                  onClick={() => onRemove(i)}
                  className="bg-background/80 hover:bg-background absolute top-1 right-1 rounded-xs p-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {previews.length === 1 && (
        <div className="space-y-2">
          <Label>Crop</Label>
          <ImageCrop src={previews[0].url} onCropChange={onCropChange} />
        </div>
      )}
      {previews.length > 1 && (
        <p className="text-muted-foreground text-xs">Cropping is available when a single image is staged.</p>
      )}
    </>
  );
}
