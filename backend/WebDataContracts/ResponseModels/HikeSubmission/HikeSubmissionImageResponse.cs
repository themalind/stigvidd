// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.HikeSubmission;

public class HikeSubmissionImageResponse
{
    public required string Identifier { get; set; }
    public required string ImageUrl { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
}
