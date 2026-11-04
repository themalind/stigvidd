// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Dialog } from "radix-ui";
import { useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Images, X } from "lucide-react";
import type { AdminTrailListItemResponse, TrailImageResponse } from "@/api/generated/model";
import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trailQueryOptions, useAddTrailImages, useDeleteTrailImage } from "@/features/trails/api/trail";

interface Props {
  data: Pick<AdminTrailListItemResponse, "identifier" | "name">;
  selected: boolean;
  label?: string;
}

export default function TrailImagesDialog({ data, selected, label }: Props) {
  const [enlarged, setEnlarged] = useState<TrailImageResponse | null>(null);

  return (
    <>
      <Dialog.Root onOpenChange={(open) => !open && setEnlarged(null)}>
        <Dialog.Trigger asChild>
          {selected ? (
            <Button variant={label ? "outline" : "ghost"} size={label ? "default" : "icon"}>
              <Images />
              {label}
            </Button>
          ) : null}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xs border p-6 shadow-lg">
            <Dialog.Title className="text-foreground mb-1 font-semibold">{data.name}</Dialog.Title>
            <Dialog.Description className="text-muted-foreground mb-4 text-sm">
              Manage images for this trail.
            </Dialog.Description>

            <QueryBoundary
              fallback={<p className="text-muted-foreground text-sm">Loading...</p>}
              errorFallback={({ retry }) => (
                <div className="flex items-center gap-3">
                  <p className="text-muted-foreground text-sm">Failed to load images.</p>
                  <Button size="sm" variant="outline" onClick={retry}>
                    Try again
                  </Button>
                </div>
              )}
            >
              <ImageGrid
                identifier={data.identifier}
                onEnlarge={setEnlarged}
                onDeleted={(id) => enlarged?.identifier === id && setEnlarged(null)}
              />
            </QueryBoundary>

            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <Button variant="outline">Close</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {enlarged && (
        <Dialog.Root open={true} onOpenChange={(open) => !open && setEnlarged(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-60 bg-black/80" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-60 -translate-x-1/2 -translate-y-1/2 outline-none">
              <Dialog.Title className="sr-only">Enlarged image</Dialog.Title>
              <Dialog.Description className="sr-only">Full-size view of the selected trail image.</Dialog.Description>
              <img
                src={enlarged.imageUrl}
                alt=""
                className="max-h-[85vh] max-w-[85vw] rounded-xs object-contain shadow-2xl"
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}

interface GridProps {
  identifier: string;
  onEnlarge: (image: TrailImageResponse) => void;
  onDeleted: (imageIdentifier: string) => void;
}

function ImageGrid({ identifier, onEnlarge, onDeleted }: GridProps) {
  const { data: trail } = useSuspenseQuery(trailQueryOptions(identifier));
  const upload = useAddTrailImages(identifier);
  const remove = useDeleteTrailImage(identifier);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const images = trail.trailImagesResponse ?? [];
  const deletingId = remove.isPending ? remove.variables : null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    upload.mutate(files, {
      onSuccess: (added) => toast.success(`${added.length} image${added.length !== 1 ? "s" : ""} uploaded.`),
      onSettled: () => {
        if (fileInputRef.current) fileInputRef.current.value = "";
      },
    });
  }

  function handleDelete(image: TrailImageResponse) {
    if (!confirm("Delete this image?")) return;
    remove.mutate(image.identifier, { onSuccess: () => onDeleted(image.identifier) });
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {images.map((img) => (
        <div key={img.identifier} className="group relative aspect-square overflow-hidden rounded-xs border">
          <img
            src={img.imageUrl}
            alt=""
            className="h-full w-full cursor-pointer object-cover"
            onClick={() => onEnlarge(img)}
          />
          <button
            onClick={() => handleDelete(img)}
            disabled={deletingId === img.identifier}
            title="Delete image"
            className={cn(
              "bg-background/80 hover:bg-background absolute top-1 right-1 rounded-xs p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
              deletingId === img.identifier && "cursor-not-allowed opacity-50",
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={upload.isPending}
        className={cn(
          "border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground aspect-square rounded-xs border-2 border-dashed text-2xl transition-colors",
          upload.isPending && "cursor-not-allowed opacity-50",
        )}
      >
        {upload.isPending ? "..." : "+"}
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
    </div>
  );
}
