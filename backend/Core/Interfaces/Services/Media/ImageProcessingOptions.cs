// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Media;

public record ImageProcessingOptions
{
    // keep-comment: leaves the image untouched apart from the EXIF/GPS strip
    public static ImageProcessingOptions StripMetadataOnly { get; } = new();

    public int? MaxWidth { get; init; }
    public int? MaxHeight { get; init; }
    public int? Quality { get; init; }
    public ImageOutputFormat Format { get; init; } = ImageOutputFormat.Original;
    public CropRectangle? Crop { get; init; }
    public AspectCrop? AspectCrop { get; init; }
}
