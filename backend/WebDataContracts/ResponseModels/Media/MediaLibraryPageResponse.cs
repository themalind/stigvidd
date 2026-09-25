// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Media;

public class MediaLibraryPageResponse
{
    public required IReadOnlyCollection<MediaItemResponse> Items { get; set; }
    public int Page { get; set; }
    public bool HasMore { get; set; }
    public int TotalCount { get; set; }

    // keep-comment: trail symbols are listed but can never be reprocessed, so this is the number a filter-expanded batch would really touch and TotalCount would overstate it
    public int ReprocessableCount { get; set; }

    public long TotalSizeBytes { get; set; }

}
