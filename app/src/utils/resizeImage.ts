// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: MPL-2.0
//
// This Source Code Form is subject to the terms of the Mozilla Public License,
// v. 2.0. If a copy of the MPL was not distributed with this file, You can
// obtain one at https://mozilla.org/MPL/2.0/.

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const MAX_IMAGE_WIDTH = 1080;
const JPEG_COMPRESSION = 0.6; // 0 = smallest file, 1 = best quality

export async function resizeImage(uri: string): Promise<string> {
  // Rendered first for its real size, after EXIF rotation. keep-comment: the picker's width and height can be pre-rotation
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  try {
    const context = ImageManipulator.manipulate(original);
    if (original.width > MAX_IMAGE_WIDTH) context.resize({ width: MAX_IMAGE_WIDTH });

    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ compress: JPEG_COMPRESSION, format: SaveFormat.JPEG });
    return result.uri;
  } finally {
    original.release();
  }
}
