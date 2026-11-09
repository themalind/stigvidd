// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> builder)
    {
        builder.HasOne(e => e.Trail)
            .WithMany()
            .HasForeignKey(e => e.TrailId)
            .OnDelete(DeleteBehavior.SetNull);

        // The feed and its (StartsAt, Id) cursor. keep-comment: column order matches the feed query
        builder.HasIndex(e => new { e.Visibility, e.Status, e.StartsAt, e.Id });

        builder.HasIndex(e => e.PastAfter);

        // Every event action starts by looking the event up by Identifier. keep-comment: hot path, not only uniqueness
        builder.HasIndex(e => e.Identifier)
            .IsUnique();

        builder.HasIndex(e => e.ClientRequestId)
            .IsUnique();
    }
}
