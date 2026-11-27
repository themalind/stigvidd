// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { Review } from "@/data/types";
import { useCanWrite, WriteBlockedReason } from "@/hooks/auth/useCanWrite";
import { useState } from "react";
import { useOwnReviewLoader } from "./useOwnReviewLoader";

export function useReviewEditor(trailIdentifier: string) {
  const { canWrite, reason } = useCanWrite();
  const ownReviewLoader = useOwnReviewLoader(trailIdentifier);
  const [visible, setVisible] = useState(false);
  const [review, setReview] = useState<Review | undefined>(undefined);
  const [blocked, setBlocked] = useState<WriteBlockedReason>(null);

  const allowed = () => {
    if (!canWrite) setBlocked(reason);
    return canWrite;
  };

  const show = (reviewToEdit: Review | undefined) => {
    setReview(reviewToEdit);
    setVisible(true);
  };

  const openCreate = () => {
    if (allowed()) show(undefined);
  };

  const openOwn = async () => {
    if (!allowed() || ownReviewLoader.isLoading) return;
    const own = await ownReviewLoader.load();
    if (own.kind === "unavailable") return;
    show(own.kind === "found" ? own.review : undefined);
  };

  return {
    openCreate,
    openOwn,
    isLoading: ownReviewLoader.isLoading,
    // keep-comment: review stays set while closing, or the modal flips to the empty create form mid-animation
    form: { review, visible, onDismiss: () => setVisible(false) },
    blocked,
    dismissBlocked: () => setBlocked(null),
  };
}

export type ReviewEditor = ReturnType<typeof useReviewEditor>;
