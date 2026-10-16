// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.HikeSubmission;

public class AdminHikeSubmissionResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public int Classification { get; set; }
    public required string Parking { get; set; }
    public required string GettingThere { get; set; }
    public required string PublicTransport { get; set; }
    public bool ShowSubmitterName { get; set; }
    public string? SubmitterNickName { get; set; }
    public DateTime TransferAcceptedAt { get; set; }
    public required string Status { get; set; }
    public string? RejectionReason { get; set; }
    public string? DecidedBy { get; set; }
    public DateTime? DecidedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public decimal TrailLength { get; set; }
    public required string Coordinates { get; set; }
    public required string OriginalCoordinates { get; set; }
    public string? PublishedTrailIdentifier { get; set; }
    public IReadOnlyCollection<HikeSubmissionImageResponse> Images { get; set; } = [];
}
