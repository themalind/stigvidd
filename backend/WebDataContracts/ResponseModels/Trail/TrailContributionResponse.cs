// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class TrailContributionResponse
{
    // keep-comment: null when the user chose not to be named or has deleted their account
    public string? SubmitterNickName { get; set; }
    public DateTime PublishedAt { get; set; }
    public int LikeCount { get; set; }
}
