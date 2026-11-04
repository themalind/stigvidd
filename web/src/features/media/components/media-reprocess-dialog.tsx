// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildImageOptions, type ProcessingValues } from "@/features/media/utils/media-upload";
import {
  matchPreset,
  NEEDS_WORK_PRESET,
  presetByKey,
  REPROCESS_PRESETS,
  type ReprocessPresetKey,
} from "@/features/media/utils/media-reprocess";
import { targetCount, type ReprocessTarget } from "@/features/media/utils/media-reprocess-target";
import { useEnqueueReprocess, type ReprocessJobSummary } from "@/features/media/api/media";
import { ProcessingControls } from "./processing-controls";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReprocessTarget;
  onSubmitted: (job: ReprocessJobSummary) => void;
}

function fromPreset(key: ReprocessPresetKey, current?: ProcessingValues): ProcessingValues {
  const { resolution, quality, format } = presetByKey(key);
  return { customWidth: "", customHeight: "", ...current, resolution, quality, format };
}

export default function MediaReprocessDialog({ open, onOpenChange, target, onSubmitted }: Props) {
  const [values, setValues] = useState(() => fromPreset(NEEDS_WORK_PRESET));
  const enqueue = useEnqueueReprocess();

  const preset = matchPreset(values.resolution, values.quality, values.format);
  const count = targetCount(target);
  const plural = count === 1 ? "" : "s";

  function handleSubmit() {
    enqueue.mutate(
      { target, options: buildImageOptions({ ...values, canCrop: false }) },
      {
        onSuccess: (job) => {
          onSubmitted(job);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xs border p-6 shadow-lg">
          <Dialog.Title className="font-semibold">
            {target.kind === "filter"
              ? `Optimize all ${count} matching image${plural}`
              : `Optimize ${count} image${plural}`}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground text-sm">
            {target.kind === "filter" ? (
              <>
                Every image matching <strong>{target.summary}</strong> — about {count} right now. The filter is expanded
                again when the job starts, so the final count may differ. Resizes, re-encodes and replaces them in the
                background; the originals are not kept.
              </>
            ) : (
              <>Resizes, re-encodes and replaces the selected images in the background. The originals are not kept.</>
            )}
          </Dialog.Description>

          <div className="space-y-1.5">
            <Label htmlFor="reprocess-preset">Preset</Label>
            <Select
              value={preset}
              onValueChange={(key) => setValues((current) => fromPreset(key as ReprocessPresetKey, current))}
            >
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

          <ProcessingControls value={values} onChange={setValues} />

          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button onClick={handleSubmit} disabled={enqueue.isPending || count === 0}>
              {enqueue.isPending ? "Starting…" : `Start batch for ${count} image${plural}`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
