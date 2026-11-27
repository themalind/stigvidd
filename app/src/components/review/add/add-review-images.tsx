// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { showErrorAtom } from "@/atoms/snackbar-atoms";
import ImageStrip from "@/components/media/image-strip";
import { MAX_REVIEW_IMAGES } from "@/constants/constants";
import { pickImages } from "@/utils/image/pick-images";
import { useSetAtom } from "jotai";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

// keep-comment: localId tells apart two picks of the same photo, which share a uri
export type ReviewFormImage =
  { kind: "stored"; identifier: string; uri: string } | { kind: "new"; localId: number; uri: string };

interface AddReviewImagesProps {
  images: ReviewFormImage[];
  onChange: (images: ReviewFormImage[]) => void;
}

function imageKey(image: ReviewFormImage) {
  return image.kind === "stored" ? image.identifier : `new-${image.localId}`;
}

export default function AddReviewImages({ images, onChange }: AddReviewImagesProps) {
  const { t } = useTranslation();
  const setError = useSetAtom(showErrorAtom);
  const nextLocalId = useRef(0);

  const pickImage = async () => {
    try {
      const uris = await pickImages({ limit: MAX_REVIEW_IMAGES - images.length });

      if (uris) {
        onChange([...images, ...uris.map((uri) => ({ kind: "new" as const, localId: nextLocalId.current++, uri }))]);
      }
    } catch {
      setError(t("review.addImageError"));
    }
  };

  return (
    <ImageStrip
      images={images.map((image) => ({ identifier: imageKey(image), imageUrl: image.uri }))}
      edit={{
        max: MAX_REVIEW_IMAGES,
        emptyHint: t("review.addImagesHint", { max: MAX_REVIEW_IMAGES }),
        onAdd: () => void pickImage(),
        onRemove: (removed) => onChange(images.filter((image) => imageKey(image) !== removed.identifier)),
      }}
    />
  );
}
