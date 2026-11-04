// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.HikeSubmission;

public class AdminHikeSubmissionResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public required int Classification { get; set; }
    public required string Parking { get; set; }
    public required string GettingThere { get; set; }
    public required string PublicTransport { get; set; }
    public required string AccessibilityInfo { get; set; }
    public required string City { get; set; }
    public required bool ShowSubmitterName { get; set; }
    public required string? SubmitterNickName { get; set; }
    public required DateTime TransferAcceptedAt { get; set; }
    public required string Status { get; set; }
    public required string? RejectionReason { get; set; }
    public required string? DecidedBy { get; set; }
    public required DateTime? DecidedAt { get; set; }
    public required DateTime CreatedAt { get; set; }
    public required DateTime LastUpdatedAt { get; set; }
    public required decimal TrailLength { get; set; }
    public required string Coordinates { get; set; }
    public required string OriginalCoordinates { get; set; }
    public required string? PublishedTrailIdentifier { get; set; }
    public required IReadOnlyCollection<HikeSubmissionImageResponse> Images { get; set; }
}
