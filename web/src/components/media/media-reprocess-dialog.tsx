// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Dialog } from "radix-ui";
import { toast } from "sonner";
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
import { buildImageOptions } from "@/lib/media-upload";
import {
  presetByKey,
  REPROCESS_PRESETS,
  type ReprocessPresetKey,
} from "@/lib/media-reprocess";
import { enqueueMediaReprocessJob, type ReprocessJobSummary } from "@/api/media";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaIdentifiers: string[];
  onSubmitted: (job: ReprocessJobSummary) => void;
}

export default function MediaReprocessDialog({
  open,
  onOpenChange,
  mediaIdentifiers,
  onSubmitted,
}: Props) {
  const [preset, setPreset] = useState<ReprocessPresetKey>("web");
  const [resolution, setResolution] = useState("1600");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState("webp");
  const [submitting, setSubmitting] = useState(false);

  function choosePreset(key: ReprocessPresetKey) {
    setPreset(key);
    const chosen = presetByKey(key);
    setResolution(chosen.resolution);
    setQuality(chosen.quality);
    setFormat(chosen.format);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const options = buildImageOptions({
        resolution,
        customWidth,
        customHeight,
        quality,
        format,
        canCrop: false,
      });
      const job = await enqueueMediaReprocessJob(mediaIdentifiers, options);
      toast.success(`Batch started for ${mediaIdentifiers.length} image(s).`);
      onSubmitted(job);
      onOpenChange(false);
    } catch {
      toast.error("Failed to start the batch.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xs border p-6 shadow-lg">
          <Dialog.Title className="font-semibold">
            Optimize {mediaIdentifiers.length} image
            {mediaIdentifiers.length === 1 ? "" : "s"}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground text-sm">
            Resizes, re-encodes and replaces the selected images in the background. The
            originals are not kept.
          </Dialog.Description>

          <div className="space-y-1.5">
            <Label htmlFor="reprocess-preset">Preset</Label>
            <Select value={preset} onValueChange={(v) => choosePreset(v as ReprocessPresetKey)}>
              <SelectTrigger id="reprocess-preset" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPROCESS_PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reprocess-resolution">Max resolution</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger id="reprocess-resolution" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original</SelectItem>
                <SelectItem value="3840">4K — 3840px</SelectItem>
                <SelectItem value="1920">Full HD — 1920px</SelectItem>
                <SelectItem value="1600">1600px</SelectItem>
                <SelectItem value="1280">1280px</SelectItem>
                <SelectItem value="800">800px</SelectItem>
                <SelectItem value="400">400px</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            {resolution === "custom" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min={1}
                  aria-label="Max width"
                  placeholder="Max width"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                />
                <Input
                  type="number"
                  min={1}
                  aria-label="Max height"
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
            <Label htmlFor="reprocess-format">Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger id="reprocess-format" className="w-full">
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

          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Starting…" : "Start batch"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
