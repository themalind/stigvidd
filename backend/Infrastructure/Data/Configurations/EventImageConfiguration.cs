// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class EventImageConfiguration : IEntityTypeConfiguration<EventImage>
{
    public void Configure(EntityTypeBuilder<EventImage> builder)
    {
        builder.HasOne(i => i.Event)
            .WithOne(e => e.Image)
            .HasForeignKey<EventImage>(i => i.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(i => i.Identifier)
            .IsUnique();
    }
}
