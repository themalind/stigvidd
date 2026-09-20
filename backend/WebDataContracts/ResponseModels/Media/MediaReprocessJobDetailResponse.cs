// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Media;

public class MediaReprocessJobDetailResponse
{
    public required MediaReprocessJobSummaryResponse Job { get; set; }
    public required IReadOnlyCollection<MediaReprocessItemResponse> Items { get; set; }

    public static MediaReprocessJobDetailResponse Create(
        MediaReprocessJobSummaryResponse job, IReadOnlyCollection<MediaReprocessItemResponse> items) => new()
    {
        Job = job,
        Items = items,
    };
}
