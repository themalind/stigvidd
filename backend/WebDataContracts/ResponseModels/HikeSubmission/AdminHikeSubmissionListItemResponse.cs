// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.HikeSubmission;

public class AdminHikeSubmissionListItemResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string? SubmitterNickName { get; set; }
    public required bool ShowSubmitterName { get; set; }
    public required DateTime CreatedAt { get; set; }
    public required decimal TrailLength { get; set; }
    public required int ImageCount { get; set; }
    public required HikeSubmissionStatus Status { get; set; }
    public required double LongestGapMetres { get; set; }
}
