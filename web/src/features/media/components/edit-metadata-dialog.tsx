// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MediaItemResponse } from "@/api/generated/model";
import { useUpdateMediaMetadata } from "@/features/media/api/media";

interface Props {
  item: MediaItemResponse;
  onClose: () => void;
}

export function EditMetadataDialog({ item, onClose }: Props) {
  const [altText, setAltText] = useState(item.altText ?? "");
  const [caption, setCaption] = useState(item.caption ?? "");
  const update = useUpdateMediaMetadata();

  function save() {
    update.mutate({ identifier: item.identifier, altText, caption }, { onSuccess: onClose });
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
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
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
