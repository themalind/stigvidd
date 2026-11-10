// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

export interface ImageSize {
  width: number;
  height: number;
}

// How far an image shown at the frame's width reaches past the frame's height, in points. keep-comment: 0 means nothing to drag
export function coverOverflow(frameWidth: number, image: ImageSize, aspect: number): number {
  if (frameWidth <= 0 || image.width <= 0) return 0;
  const shownHeight = (frameWidth * image.height) / image.width;
  return Math.max(0, shownHeight - frameWidth / aspect);
}

// Dragging down shows more of the top, so the focus moves against the finger. keep-comment: why the sign is negative
export function focusAfterDrag(startFocus: number, dragY: number, overflow: number): number {
  if (overflow <= 0) return startFocus;
  return Math.min(1, Math.max(0, startFocus - dragY / overflow));
}
