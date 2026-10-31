// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class EventPostConfiguration : IEntityTypeConfiguration<EventPost>
{
    public void Configure(EntityTypeBuilder<EventPost> builder)
    {
        builder.HasOne(p => p.Event)
            .WithMany(e => e.Posts)
            .HasForeignKey(p => p.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Named so IgnoreQueryFilters(["Moderation"]) can drop just this one. keep-comment: the name is referenced by string elsewhere
        builder.HasQueryFilter("Moderation", p => p.ModerationState == ModerationState.Visible);

        // The board and its (CreatedAt, Id) cursor. keep-comment: column order matches the board query
        builder.HasIndex(p => new { p.EventId, p.CreatedAt, p.Id });

        builder.HasIndex(p => p.Identifier)
            .IsUnique();
    }
}
