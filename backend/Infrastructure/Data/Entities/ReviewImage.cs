// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class ReviewImage : BaseEntity
{
    public required string ImageUrl { get; set; }
    public int ReviewId { get; set; }

    public Review? Review { get; set; }
}
