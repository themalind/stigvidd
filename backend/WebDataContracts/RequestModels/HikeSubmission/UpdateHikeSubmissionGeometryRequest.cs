// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.HikeSubmission;

public class UpdateHikeSubmissionGeometryRequest
{
    // keep-comment: same JSON shape as CreateHikeRequest.Coordinates, [{ latitude, longitude }]
    public required string Coordinates { get; set; }
}
