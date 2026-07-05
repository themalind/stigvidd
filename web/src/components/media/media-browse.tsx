import { useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAllMedia, updateImageMetadata } from "@/api/media";
import { deleteTrailImage } from "@/api/trail";
import { deleteFacilityImage } from "@/api/facility";
import type { MediaItemResponse } from "@/types/types";

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  refreshKey: number;
}

export default function MediaBrowse({ refreshKey }: Props) {
  const [items, setItems] = useState<MediaItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [enlarged, setEnlarged] = useState<MediaItemResponse | null>(null);
  const [editing, setEditing] = useState<MediaItemResponse | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await getAllMedia());
    } catch {
      toast.error("Failed to load media.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

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
        prev.map((i) =>
          i.identifier === editing.identifier ? { ...i, altText, caption } : i,
        ),
      );
      toast.success("Metadata saved.");
      setEditing(null);
    } catch {
      toast.error("Failed to save metadata.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: MediaItemResponse) {
    if (item.ownerType === "TrailSymbol") return;
    if (!confirm("Delete this image?")) return;
    try {
      if (item.ownerType === "Trail") await deleteTrailImage(item.identifier);
      else if (item.ownerType === "Facility")
        await deleteFacilityImage(item.identifier);
      setItems((prev) => prev.filter((i) => i.identifier !== item.identifier));
      toast.success("Image deleted.");
    } catch {
      toast.error("Failed to delete image.");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No media yet. Upload some images from the Upload tab.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          const editable = item.ownerType !== "TrailSymbol";
          return (
            <div
              key={`${item.ownerType}-${item.identifier}`}
              className="group overflow-hidden rounded-xs border"
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.altText ?? ""}
                  className="h-full w-full cursor-pointer object-cover"
                  onClick={() => setEnlarged(item)}
                />
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {editable && (
                    <button
                      onClick={() => openEdit(item)}
                      className="bg-background/80 hover:bg-background rounded-xs p-1"
                      title="Edit metadata"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  )}
                  {editable && (
                    <button
                      onClick={() => handleDelete(item)}
                      className="bg-background/80 hover:bg-background rounded-xs p-1"
                      title="Delete"
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
                  {item.width && item.height
                    ? `${item.width}×${item.height} · `
                    : ""}
                  {formatBytes(item.sizeBytes)}
                </p>
              </div>
            </div>
          );
        })}
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
                className="max-h-[85vh] max-w-[85vw] rounded-xs object-contain shadow-2xl"
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
