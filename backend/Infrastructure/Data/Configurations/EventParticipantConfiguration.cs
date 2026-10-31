// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class EventParticipantConfiguration : IEntityTypeConfiguration<EventParticipant>
{
    public void Configure(EntityTypeBuilder<EventParticipant> builder)
    {
        builder.HasKey(p => new { p.EventId, p.UserId });

        builder.HasOne(p => p.Event)
            .WithMany(e => e.Participants)
            .HasForeignKey(p => p.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => new { p.UserId, p.Status });

        // At most one organizer per event; a hand-over demotes the old row before promoting the new one. keep-comment: the order a hand-over must follow
        builder.HasIndex(p => p.EventId)
            .IsUnique()
            .HasFilter("\"Role\" = 0")
            .HasDatabaseName("IX_EventParticipants_OneOrganizer");
    }
}
