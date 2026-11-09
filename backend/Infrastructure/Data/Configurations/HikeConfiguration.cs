// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class HikeConfiguration : IEntityTypeConfiguration<Hike>
{
    public void Configure(EntityTypeBuilder<Hike> builder)
    {
        builder.HasOne(h => h.User)
            .WithMany()
            .HasForeignKey(h => h.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(h => h.HikeLength)
            .HasPrecision(18, 2);

        // A retry key is unique per user, so one user's key never blocks another's save. keep-comment: keys are client-made
        builder.HasIndex(h => new { h.UserId, h.ClientRequestId })
            .IsUnique();
    }
}
