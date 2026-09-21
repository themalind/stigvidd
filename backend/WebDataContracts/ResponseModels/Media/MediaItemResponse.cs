// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Media;

public class MediaItemResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
    public string? AltText { get; set; }
    public string? Caption { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }

    // keep-comment: the stored file extension, lower-cased, and "jpeg" never "jpg" - it is the same token MediaFilter.Format accepts and ImageProcessingOptionsRequest.Format sends, so a client can round-trip it without parsing the URL
    public required string Format { get; set; }

    /// <summary>"Trail" | "Facility" | "TrailSymbol"</summary>
    public required string OwnerType { get; set; }
    public string? OwnerIdentifier { get; set; }
    public string? OwnerName { get; set; }

    public static MediaItemResponse Create(
        string presentableUrl, string identifier, string imageUrl, string? altText, string? caption,
        int width, int height, long sizeBytes, DateTime createdAt, string ownerType,
        string? ownerIdentifier, string? ownerName)
    {
        return new MediaItemResponse
        {
            Identifier = identifier,
            ImageUrl = $"{presentableUrl}{imageUrl}",
            AltText = altText,
            Caption = caption,
            Width = width,
            Height = height,
            SizeBytes = sizeBytes,
            CreatedAt = createdAt,
            Format = FormatOf(imageUrl),
            OwnerType = ownerType,
            OwnerIdentifier = ownerIdentifier,
            OwnerName = ownerName
        };
    }

    public static string FormatOf(string imageUrl)
    {
        var lastDot = imageUrl.LastIndexOf('.');
        if (lastDot < 0 || lastDot == imageUrl.Length - 1)
            return string.Empty;

        var extension = imageUrl[(lastDot + 1)..].ToLowerInvariant();

        return extension switch
        {
            "jpg" => "jpeg",
            _ => extension
        };
    }
}
