import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ImageCrop, { type CropRect } from "./image-crop";
import {
  getAllTrails,
  addTrailImages,
  deleteTrailImage,
  setTrailSymbol,
} from "@/api/trail";
import {
  getAllFacilities,
  uploadFacilityImages,
  deleteFacilityImage,
} from "@/api/facility";
import { getAllMedia } from "@/api/media";
import {
  loadStagedFiles,
  loadStagedTarget,
  saveStagedFiles,
  saveStagedTarget,
} from "@/lib/staged-media";
import {
  CLASSIFICATION,
  type FacilityResponse,
  type ImageProcessingOptions,
  type MediaItemResponse,
  type TrailShortInfoResponse,
} from "@/types/types";

type TargetType = "trail-gallery" | "trail-symbol" | "facility";

/** The `ownerType` the media library reports for each upload target. */
const OWNER_TYPE: Record<TargetType, string> = {
  "trail-gallery": "Trail",
  "trail-symbol": "TrailSymbol",
  facility: "Facility",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Trails can share a name, so the option label carries length + city to tell
// same-named trails apart; the panel under the select shows the full details.
function trailLabel(trail: TrailShortInfoResponse): string {
  const details = [`${trail.trailLength} km`];
  if (trail.city) details.push(trail.city);
  return `${trail.name} — ${details.join(" · ")}`;
}

interface Props {
  onMediaChanged: () => void;
}

export default function MediaUpload({ onMediaChanged }: Props) {
  // Restored synchronously so the first render already has the previous target.
  const [targetType, setTargetType] = useState<TargetType>(() => {
    const stored = loadStagedTarget()?.targetType;
    return stored && stored in OWNER_TYPE
      ? (stored as TargetType)
      : "trail-gallery";
  });
  const [targetId, setTargetId] = useState<string>(
    () => loadStagedTarget()?.targetId ?? "",
  );
  const [trails, setTrails] = useState<TrailShortInfoResponse[]>([]);
  const [facilities, setFacilities] = useState<FacilityResponse[]>([]);

  const [media, setMedia] = useState<MediaItemResponse[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [crop, setCrop] = useState<CropRect | null>(null);

  const [resolution, setResolution] = useState<string>("1920");
  const [customWidth, setCustomWidth] = useState<string>("");
  const [customHeight, setCustomHeight] = useState<string>("");
  const [quality, setQuality] = useState<number>(82);
  const [format, setFormat] = useState<string>("webp");

  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSymbol = targetType === "trail-symbol";
  const allowMultiple = !isSymbol;

  async function loadMedia() {
    setMediaLoading(true);
    try {
      setMedia(await getAllMedia());
    } catch {
      toast.error("Failed to load existing images.");
    } finally {
      setMediaLoading(false);
    }
  }

  useEffect(() => {
    getAllTrails()
      .then((t) =>
        setTrails(
          // Same-named trails end up next to each other, shortest first.
          t.sort(
            (a, b) =>
              a.name.localeCompare(b.name) || a.trailLength - b.trailLength,
          ),
        ),
      )
      .catch(() => toast.error("Failed to load trails."));
    getAllFacilities()
      .then((f) =>
        setFacilities(f.sort((a, b) => a.name.localeCompare(b.name))),
      )
      .catch(() => toast.error("Failed to load facilities."));
    loadMedia();
  }, []);

  const selectedTrail = useMemo(
    () => trails.find((t) => t.identifier === targetId),
    [trails, targetId],
  );

  // Images already attached to the selected target, from the media library.
  const existing = useMemo(
    () =>
      targetId
        ? media.filter(
            (m) =>
              m.ownerIdentifier === targetId &&
              m.ownerType === OWNER_TYPE[targetType],
          )
        : [],
    [media, targetId, targetType],
  );

  // Reset target + crop when switching what we attach to. Driven by the picker
  // rather than an effect, so the target restored on mount survives.
  function changeTargetType(next: TargetType) {
    setTargetType(next);
    setTargetId("");
    setCrop(null);
  }

  useEffect(() => {
    saveStagedTarget({ targetType, targetId });
  }, [targetType, targetId]);

  // Drop a restored target that no longer exists (deleted between sessions).
  useEffect(() => {
    if (!targetId) return;
    const list = targetType === "facility" ? facilities : trails;
    if (list.length === 0) return;
    if (!list.some((o) => o.identifier === targetId)) setTargetId("");
  }, [targetId, targetType, trails, facilities]);

  // Bring back files staged before a refresh, then keep the store in sync.
  // Persisting only starts once the read has finished, so the empty initial
  // state cannot wipe what is stored.
  const [filesRestored, setFilesRestored] = useState(false);
  useEffect(() => {
    let cancelled = false;
    loadStagedFiles().then((staged) => {
      if (cancelled) return;
      // Anything picked while the read was in flight wins over the stored set.
      if (staged.length > 0) setFiles((prev) => (prev.length ? prev : staged));
      setFilesRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!filesRestored) return;
    saveStagedFiles(files);
  }, [files, filesRestored]);

  // Symbol takes a single file; drop extras when switching into symbol mode.
  useEffect(() => {
    if (isSymbol && files.length > 1) setFiles((prev) => prev.slice(0, 1));
  }, [isSymbol, files.length]);

  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files],
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  const canCrop = files.length === 1;
  useEffect(() => {
    if (!canCrop && crop) setCrop(null);
  }, [canCrop, crop]);

  function addFiles(incoming: FileList | File[]) {
    const imgs = Array.from(incoming).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (imgs.length === 0) return;
    setFiles((prev) => (allowMultiple ? [...prev, ...imgs] : [imgs[0]]));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function buildOptions(): ImageProcessingOptions {
    const options: ImageProcessingOptions = {};
    if (resolution === "custom") {
      if (customWidth) options.maxWidth = Number(customWidth);
      if (customHeight) options.maxHeight = Number(customHeight);
    } else if (resolution !== "original") {
      options.maxWidth = Number(resolution);
      options.maxHeight = Number(resolution);
    }
    if (format !== "original") options.format = format;
    options.quality = quality;
    if (canCrop && crop) {
      options.cropX = crop.x;
      options.cropY = crop.y;
      options.cropWidth = crop.width;
      options.cropHeight = crop.height;
    }
    return options;
  }

  async function handleUpload() {
    if (!targetId) {
      toast.error("Choose what to attach the image(s) to.");
      return;
    }
    if (files.length === 0) {
      toast.error("Add at least one image.");
      return;
    }
    setUploading(true);
    try {
      const options = buildOptions();
      if (targetType === "trail-gallery") {
        const added = await addTrailImages(targetId, files, options);
        toast.success(`${added.length} image(s) added to trail.`);
      } else if (targetType === "trail-symbol") {
        await setTrailSymbol(targetId, files[0], options);
        toast.success("Trail symbol updated.");
      } else {
        const added = await uploadFacilityImages(targetId, files, options);
        toast.success(`${added.length} image(s) added to facility.`);
      }
      setFiles([]);
      setCrop(null);
      await loadMedia();
      onMediaChanged();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteExisting(item: MediaItemResponse) {
    // The symbol has no delete endpoint — it is replaced by uploading a new one.
    if (item.ownerType === "TrailSymbol") return;
    if (!confirm("Delete this image?")) return;
    setDeletingId(item.identifier);
    try {
      if (item.ownerType === "Trail") await deleteTrailImage(item.identifier);
      else await deleteFacilityImage(item.identifier);
      setMedia((prev) => prev.filter((m) => m.identifier !== item.identifier));
      toast.success("Image deleted.");
      onMediaChanged();
    } catch {
      toast.error("Failed to delete image.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left: target + files */}
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Attach to</Label>
            <Select
              value={targetType}
              onValueChange={(v) => changeTargetType(v as TargetType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trail-gallery">Trail — gallery</SelectItem>
                <SelectItem value="trail-symbol">Trail — symbol</SelectItem>
                <SelectItem value="facility">Facility</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{targetType === "facility" ? "Facility" : "Trail"}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {targetType === "facility"
                  ? facilities.map((f) => (
                      <SelectItem key={f.identifier} value={f.identifier}>
                        {f.name}
                      </SelectItem>
                    ))
                  : trails.map((t) => (
                      <SelectItem key={t.identifier} value={t.identifier}>
                        {trailLabel(t)}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Details of the chosen trail — the last resort for telling apart
            trails that share a name, length and city. */}
        {selectedTrail && targetType !== "facility" && (
          <div className="bg-muted/40 space-y-1 rounded-xs border p-3 text-xs">
            <p className="text-sm font-medium">{selectedTrail.name}</p>
            <p className="text-muted-foreground">
              {selectedTrail.trailLength} km
              {selectedTrail.city ? ` · ${selectedTrail.city}` : ""} ·{" "}
              {CLASSIFICATION[selectedTrail.classification] ?? "Unknown"} ·{" "}
              {selectedTrail.accessibility ? "Accessible" : "Not accessible"}
            </p>
            <p className="text-muted-foreground font-mono text-[10px] break-all">
              {selectedTrail.identifier}
            </p>
          </div>
        )}

        {/* Images already attached to the chosen target */}
        {targetId && (
          <div className="space-y-2">
            <Label>
              {isSymbol ? "Current symbol" : "Existing images"}
              {!mediaLoading && existing.length > 0 && (
                <span className="text-muted-foreground font-normal">
                  &nbsp;({existing.length})
                </span>
              )}
            </Label>
            {mediaLoading ? (
              <p className="text-muted-foreground text-xs">Loading…</p>
            ) : existing.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                {isSymbol
                  ? "No symbol set yet."
                  : "No images attached yet — the ones you upload will show up here."}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {existing.map((item) => (
                  <div
                    key={`${item.ownerType}-${item.identifier}`}
                    className="group relative aspect-square overflow-hidden rounded-xs border"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.altText ?? ""}
                      className={cn(
                        "h-full w-full",
                        isSymbol
                          ? "bg-muted object-contain p-2"
                          : "object-cover",
                      )}
                    />
                    {!isSymbol && (
                      <button
                        type="button"
                        onClick={() => handleDeleteExisting(item)}
                        disabled={deletingId === item.identifier}
                        title="Delete image"
                        className={cn(
                          "bg-background/80 hover:bg-background absolute top-1 right-1 rounded-xs p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
                          deletingId === item.identifier &&
                            "cursor-not-allowed opacity-50",
                        )}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                    {item.width > 0 && item.height > 0 && (
                      <span className="bg-background/80 absolute right-0 bottom-0 left-0 truncate px-1 py-0.5 text-[10px]">
                        {item.width}×{item.height} ·{" "}
                        {formatBytes(item.sizeBytes)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {isSymbol && existing.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Uploading a new symbol replaces the current one.
              </p>
            )}
          </div>
        )}

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xs border-2 border-dashed p-8 text-center transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/40 hover:border-muted-foreground",
          )}
        >
          <p className="text-sm font-medium">
            Drop image{allowMultiple ? "s" : ""} here or click to browse
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {isSymbol ? "One image for the trail symbol." : "PNG, JPEG, WebP…"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple={allowMultiple}
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Staged files — kept across a refresh, hence the explicit clear. */}
        {previews.length > 0 && (
          <div className="flex items-center justify-between">
            <Label>
              Staged for upload
              <span className="text-muted-foreground font-normal">
                &nbsp;({previews.length})
              </span>
            </Label>
            <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
              Clear
            </Button>
          </div>
        )}
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {previews.map((p, i) => (
              <div
                key={p.url}
                className="group relative aspect-square overflow-hidden rounded-xs border"
              >
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="bg-background/80 absolute bottom-0 left-0 right-0 truncate px-1 py-0.5 text-[10px]">
                  {formatBytes(p.file.size)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="bg-background/80 hover:bg-background absolute top-1 right-1 rounded-xs p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Crop (single image only) */}
        {canCrop && previews[0] && (
          <div className="space-y-2">
            <Label>Crop</Label>
            <ImageCrop src={previews[0].url} onCropChange={setCrop} />
          </div>
        )}
        {files.length > 1 && (
          <p className="text-muted-foreground text-xs">
            Cropping is available when a single image is staged.
          </p>
        )}
      </div>

      {/* Right: processing controls */}
      <div className="space-y-5 rounded-xs border p-4">
        <h3 className="text-sm font-semibold">Processing</h3>

        <div className="space-y-1.5">
          <Label>Max resolution</Label>
          <Select value={resolution} onValueChange={setResolution}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="3840">4K — 3840px</SelectItem>
              <SelectItem value="1920">Full HD — 1920px</SelectItem>
              <SelectItem value="1280">1280px</SelectItem>
              <SelectItem value="800">800px</SelectItem>
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {resolution === "custom" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                placeholder="Max width"
                value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
              />
              <Input
                type="number"
                min={1}
                placeholder="Max height"
                value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Quality</Label>
            <span className="text-muted-foreground text-sm">{quality}</span>
          </div>
          <Slider
            min={10}
            max={100}
            step={1}
            value={[quality]}
            onValueChange={(v) => setQuality(v[0])}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Format</Label>
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">Keep original</SelectItem>
              <SelectItem value="webp">WebP</SelectItem>
              <SelectItem value="jpeg">JPEG</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className="w-full" disabled={uploading} onClick={handleUpload}>
          {uploading ? "Uploading…" : "Process & upload"}
        </Button>
      </div>
    </div>
  );
}
