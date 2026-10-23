// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.HikeSubmission;

public class UpdateHikeSubmissionRequest
{
    public required string Name { get; set; }
    public required string Description { get; set; }
    public int Classification { get; set; }
    public string? Parking { get; set; }
    public required string GettingThere { get; set; }
    public string? PublicTransport { get; set; }
    public string? AccessibilityInfo { get; set; }
    public required string City { get; set; }
    public DateTime LastUpdatedAt { get; set; }
}
