// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class HikeImage : BaseEntity
{
    public int HikeId { get; set; }
    public required string ImageUrl { get; set; }
    public Hike? Hike { get; set; }
}
