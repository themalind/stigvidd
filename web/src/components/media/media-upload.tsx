import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
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
import { getAllTrails, addTrailImages, setTrailSymbol } from "@/api/trail";
import { getAllFacilities, uploadFacilityImages } from "@/api/facility";
import type {
  FacilityResponse,
  ImageProcessingOptions,
  TrailShortInfoResponse,
} from "@/types/types";

type TargetType = "trail-gallery" | "trail-symbol" | "facility";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  onUploaded: () => void;
}

export default function MediaUpload({ onUploaded }: Props) {
  const [targetType, setTargetType] = useState<TargetType>("trail-gallery");
  const [targetId, setTargetId] = useState<string>("");
  const [trails, setTrails] = useState<TrailShortInfoResponse[]>([]);
  const [facilities, setFacilities] = useState<FacilityResponse[]>([]);

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

  useEffect(() => {
    getAllTrails()
      .then((t) => setTrails(t.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => toast.error("Failed to load trails."));
    getAllFacilities()
      .then((f) => setFacilities(f.sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => toast.error("Failed to load facilities."));
  }, []);

  // Reset target + crop when switching what we attach to.
  useEffect(() => {
    setTargetId("");
    setCrop(null);
  }, [targetType]);

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
    const imgs = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
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
      onUploaded();
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
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
              onValueChange={(v) => setTargetType(v as TargetType)}
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
                {(targetType === "facility" ? facilities : trails).map((o) => (
                  <SelectItem key={o.identifier} value={o.identifier}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

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

        {/* Staged files */}
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

        <Button
          className="w-full"
          disabled={uploading}
          onClick={handleUpload}
        >
          {uploading ? "Uploading…" : "Process & upload"}
        </Button>
      </div>
    </div>
  );
}
