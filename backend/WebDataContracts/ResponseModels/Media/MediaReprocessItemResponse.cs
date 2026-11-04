// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.Media;

public class MediaReprocessItemResponse
{
    public required string Identifier { get; set; }
    public required string MediaIdentifier { get; set; }

    /// <summary>"Trail" | "Facility"</summary>
    public required string OwnerType { get; set; }

    public required MediaReprocessItemStatus Status { get; set; }

    public required string? LastError { get; set; }
    public required DateTime CreatedAt { get; set; }
    public required DateTime LastUpdatedAt { get; set; }

    public static MediaReprocessItemResponse Create(
        string identifier,
        string mediaIdentifier,
        string ownerType,
        MediaReprocessItemStatus status,
        string? lastError,
        DateTime createdAt,
        DateTime lastUpdatedAt) => new()
    {
        Identifier = identifier,
        MediaIdentifier = mediaIdentifier,
        OwnerType = ownerType,
        Status = status,
        LastError = lastError,
        CreatedAt = createdAt,
        LastUpdatedAt = lastUpdatedAt,
    };
}
