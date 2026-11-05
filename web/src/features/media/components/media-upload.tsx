// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUploadImages } from "@/features/media/api/media";
import { useStagedFiles } from "@/features/media/hooks/use-staged-files";
import {
  buildImageOptions,
  OWNER_TYPE,
  type CropRect,
  type FacilityOption,
  type OwnerList,
  type ProcessingValues,
  type TargetType,
  type TrailOption,
} from "@/features/media/utils/media-upload";
import { loadStagedTarget, saveStagedTarget, type StagedTarget } from "@/features/media/utils/staged-media";
import { AttachedImages } from "./attached-images";
import { ProcessingControls } from "./processing-controls";
import { StagedFiles } from "./staged-files";
import { UploadTargetPicker } from "./upload-target-picker";

const DEFAULT_PROCESSING: ProcessingValues = {
  resolution: "1920",
  customWidth: "",
  customHeight: "",
  quality: 82,
  format: "webp",
};

function restoreTarget(): { targetType: TargetType; targetId: string } {
  const stored: StagedTarget | null = loadStagedTarget();
  const targetType = Object.keys(OWNER_TYPE).find((type): type is TargetType => type === stored?.targetType);
  return { targetType: targetType ?? "trail-gallery", targetId: stored?.targetId ?? "" };
}

interface Props {
  trails: OwnerList<TrailOption>;
  facilities: OwnerList<FacilityOption>;
  onTrailImagesChanged: () => void;
}

export default function MediaUpload({ trails, facilities, onTrailImagesChanged }: Props) {
  const [target, setTarget] = useState(restoreTarget);
  const [processing, setProcessing] = useState(DEFAULT_PROCESSING);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const isSymbol = target.targetType === "trail-symbol";
  const staged = useStagedFiles(isSymbol);
  const upload = useUploadImages(onTrailImagesChanged);

  // keep-comment: a remembered target that the loaded list no longer has was deleted since; an unloaded list proves nothing
  const list = target.targetType === "facility" ? facilities.items : trails.items;
  const targetId = list && !list.some((o) => o.identifier === target.targetId) ? "" : target.targetId;

  function chooseTarget(next: { targetType: TargetType; targetId: string }) {
    setTarget(next);
    saveStagedTarget(next);
    setCrop(null);
  }

  function handleUpload() {
    if (!targetId) {
      toast.error("Choose what to attach the image(s) to.");
      return;
    }
    if (staged.files.length === 0) {
      toast.error("Add at least one image.");
      return;
    }

    const options = buildImageOptions({ ...processing, crop, canCrop: staged.files.length === 1 });
    upload.mutate(
      { targetType: target.targetType, targetId, files: staged.files, options },
      {
        onSuccess: () => {
          staged.clear();
          setCrop(null);
        },
      },
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <UploadTargetPicker
          targetType={target.targetType}
          targetId={targetId}
          trails={trails}
          facilities={facilities}
          onTargetTypeChange={(targetType) => chooseTarget({ targetType, targetId: "" })}
          onTargetIdChange={(id) => chooseTarget({ targetType: target.targetType, targetId: id })}
        />

        {targetId && (
          <AttachedImages
            targetType={target.targetType}
            targetId={targetId}
            onTrailImagesChanged={onTrailImagesChanged}
          />
        )}

        <StagedFiles
          files={staged.files}
          single={isSymbol}
          onAdd={staged.add}
          onRemove={staged.remove}
          onClear={staged.clear}
          onCropChange={setCrop}
        />
      </div>

      <div className="space-y-5 rounded-xs border p-4">
        <h3 className="text-sm font-semibold">Processing</h3>
        <ProcessingControls value={processing} onChange={setProcessing} />
        <Button className="w-full" disabled={upload.isPending} onClick={handleUpload}>
          {upload.isPending ? "Uploading…" : "Process & upload"}
        </Button>
      </div>
    </div>
  );
}
