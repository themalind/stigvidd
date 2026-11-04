// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Dialog } from "radix-ui";

interface Props {
  image: { imageUrl: string; altText?: string | null } | null;
  onClose: () => void;
}

export function ImageLightbox({ image, onClose }: Props) {
  return (
    <Dialog.Root open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-black/80" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-60 -translate-x-1/2 -translate-y-1/2 outline-none">
          <Dialog.Title className="sr-only">Enlarged image</Dialog.Title>
          <Dialog.Description className="sr-only">Full-size view of the selected image.</Dialog.Description>
          {image && (
            <img
              src={image.imageUrl}
              alt={image.altText ?? ""}
              decoding="async"
              className="max-h-[85vh] max-w-[85vw] rounded-xs object-contain shadow-2xl"
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
