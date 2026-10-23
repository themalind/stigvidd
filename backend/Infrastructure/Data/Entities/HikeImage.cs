// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

public class HikeImage : BaseEntity
{
    public int HikeId { get; set; }
    public required string ImageUrl { get; set; }
    // No global query filter, unlike Review: hiding happens in HikeResponseFactory.CreateImages. keep-comment: cleanup and shared-file checks must see hidden rows
    public ModerationState ModerationState { get; set; }
    public Hike? Hike { get; set; }
}
