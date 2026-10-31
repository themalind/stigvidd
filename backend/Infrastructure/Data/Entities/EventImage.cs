// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

public class EventImage : BaseEntity
{
    public int EventId { get; set; }
    public required string ImageUrl { get; set; }
    // No global query filter, like HikeImage: the shared-file checks must see hidden rows. keep-comment: why hiding happens in the factory
    public ModerationState ModerationState { get; set; }
    public Event? Event { get; set; }
}
