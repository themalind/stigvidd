// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.HikeSubmission;

public class SimilarTrailResponse
{
    // keep-comment: a trail identifier for "Trail" and "Contribution", a submission identifier for "Submission"
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string Kind { get; set; }
    // keep-comment: shares from 0 to 1; the first is how much of the walk runs along the other route, the second the reverse
    public required double WalkOnRoute { get; set; }
    public required double RouteOnWalk { get; set; }
    public required bool LikelyDuplicate { get; set; }
}
