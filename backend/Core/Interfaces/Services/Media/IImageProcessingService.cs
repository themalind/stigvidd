// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Media;

public interface IImageProcessingService
{
    /// <summary>
    /// Applies crop, resize (down-only, aspect preserved), quality and format conversion to the
    /// source image, and always strips EXIF/GPS metadata. The returned <see cref="ProcessedImage"/>
    /// owns a rewound stream ready to upload.
    /// </summary>
    ProcessedImage Process(Stream input, ImageProcessingOptions options);
}
