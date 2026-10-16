// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.HikeSubmission;

public class AdminHikeSubmissionListItemResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public string? SubmitterNickName { get; set; }
    public bool ShowSubmitterName { get; set; }
    public DateTime CreatedAt { get; set; }
    public decimal TrailLength { get; set; }
    public int ImageCount { get; set; }
    public required string Status { get; set; }
    public double LongestGapMetres { get; set; }
}
