// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class EventRouteConfiguration : IEntityTypeConfiguration<EventRoute>
{
    public void Configure(EntityTypeBuilder<EventRoute> builder)
    {
        builder.HasKey(r => r.EventId);

        builder.HasOne(r => r.Event)
            .WithOne(e => e.Route)
            .HasForeignKey<EventRoute>(r => r.EventId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
