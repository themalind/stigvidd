// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Trail;

public class TrailLikeResponse
{
    public int LikeCount { get; set; }
    public bool LikedByMe { get; set; }
}
