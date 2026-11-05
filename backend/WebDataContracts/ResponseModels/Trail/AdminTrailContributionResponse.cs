// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class AdminTrailContributionResponse
{
    // keep-comment: null once the submitter has deleted their account
    public string? SubmitterNickName { get; set; }
    public required bool ShowSubmitterName { get; set; }
    public required DateTime PublishedAt { get; set; }
    public required int LikeCount { get; set; }
    // keep-comment: null once the submission is gone, which happens when the submitter deletes their account
    public string? SubmissionIdentifier { get; set; }
}
