import { Dialog } from "radix-ui";
import { useRef, useState } from "react";
import {
  addTrailImages,
  deleteTrailImage,
  getTrailByIdentifier,
} from "@/api/trail";
import type { TrailImageResponse, TrailShortInfoResponse } from "@/types/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { Images, X } from "lucide-react";

interface Props {
  data: TrailShortInfoResponse;
  selected: boolean;
}

export default function TrailImagesDialog({ data, selected }: Props) {
  const [images, setImages] = useState<TrailImageResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState<TrailImageResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleOpenChange(open: boolean) {
    if (!open) {
      setEnlarged(null);
      return;
    }
    setLoading(true);
    try {
      const trail = await getTrailByIdentifier({ identifier: data.identifier });
      setImages(trail.trailImagesResponse ?? []);
    } catch {
      toast.error("Failed to load images.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newImages = await addTrailImages(data.identifier, files);
      setImages((prev) => [...prev, ...newImages]);
      toast.success(
        `${newImages.length} image${newImages.length !== 1 ? "s" : ""} uploaded.`,
      );
    } catch {
      toast.error("Failed to upload images.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(img: TrailImageResponse) {
    setDeletingId(img.identifier);
    try {
      await deleteTrailImage(img.identifier);
      setImages((prev) => prev.filter((i) => i.identifier !== img.identifier));
      if (enlarged?.identifier === img.identifier) setEnlarged(null);
      toast.success("Image deleted.");
    } catch {
      toast.error("Failed to delete image.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Dialog.Root onOpenChange={handleOpenChange}>
        <Dialog.Trigger asChild>
          {selected ? (
            <Button variant="ghost" size="icon">
              <Images />
            </Button>
          ) : null}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xs border p-6 shadow-lg">
            <Dialog.Title className="text-foreground mb-1 font-semibold">
              {data.name}
            </Dialog.Title>
            <Dialog.Description className="text-muted-foreground mb-4 text-sm">
              Manage images for this trail.
            </Dialog.Description>

            {loading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {images.map((img) => (
                  <div
                    key={img.identifier}
                    className="group relative aspect-square overflow-hidden rounded-xs border"
                  >
                    <img
                      src={img.imageUrl}
                      alt=""
                      className="h-full w-full cursor-pointer object-cover"
                      onClick={() => setEnlarged(img)}
                    />
                    <button
                      onClick={() => handleDelete(img)}
                      disabled={deletingId === img.identifier}
                      className={cn(
                        "bg-background/80 hover:bg-background absolute top-1 right-1 rounded-xs p-0.5 opacity-0 transition-opacity group-hover:opacity-100",
                        deletingId === img.identifier &&
                          "cursor-not-allowed opacity-50",
                      )}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={cn(
                    "border-muted-foreground/40 text-muted-foreground hover:border-muted-foreground hover:text-foreground aspect-square rounded-xs border-2 border-dashed text-2xl transition-colors",
                    uploading && "cursor-not-allowed opacity-50",
                  )}
                >
                  {uploading ? "..." : "+"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Dialog.Close asChild>
                <Button variant="outline">Close</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {enlarged && (
        <Dialog.Root
          open={true}
          onOpenChange={(open) => !open && setEnlarged(null)}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-60 bg-black/80" />
            <Dialog.Content className="fixed top-1/2 left-1/2 z-60 -translate-x-1/2 -translate-y-1/2 outline-none">
              <Dialog.Title className="sr-only">Enlarged image</Dialog.Title>
              <Dialog.Description className="sr-only">
                Full-size view of the selected trail image.
              </Dialog.Description>
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
