// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.HikeSubmission;

public class CreateHikeSubmissionRequest
{
    public required string HikeIdentifier { get; set; }
    public required string Name { get; set; }
    public required string Description { get; set; }
    public int Classification { get; set; }
    public string? Parking { get; set; }
    public required string GettingThere { get; set; }
    public string? PublicTransport { get; set; }
    public string? AccessibilityInfo { get; set; }
    public required string City { get; set; }
    public bool ShowSubmitterName { get; set; }
    public bool AcceptTransfer { get; set; }
    public required string ConsentVersion { get; set; }
    public required string ConsentLocale { get; set; }
    // keep-comment: inclusive indexes into the hike's coordinates; null keeps that end as recorded
    public int? TrimStartIndex { get; set; }
    public int? TrimEndIndex { get; set; }
    public IReadOnlyCollection<string> ImageIdentifiers { get; set; } = [];
}
