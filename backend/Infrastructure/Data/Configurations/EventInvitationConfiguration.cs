// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class EventInvitationConfiguration : IEntityTypeConfiguration<EventInvitation>
{
    public void Configure(EntityTypeBuilder<EventInvitation> builder)
    {
        builder.HasKey(i => new { i.EventId, i.InvitedUserId });

        builder.HasOne(i => i.Event)
            .WithMany(e => e.Invitations)
            .HasForeignKey(i => i.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.InvitedUser)
            .WithMany()
            .HasForeignKey(i => i.InvitedUserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(i => i.InvitedBy)
            .WithMany()
            .HasForeignKey(i => i.InvitedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(i => new { i.InvitedUserId, i.Status });

        builder.HasIndex(i => new { i.InvitedByUserId, i.CreatedAt });
    }
}
