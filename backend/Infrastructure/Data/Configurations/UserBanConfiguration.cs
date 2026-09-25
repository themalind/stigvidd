// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class UserBanConfiguration : IEntityTypeConfiguration<UserBan>
{
    public void Configure(EntityTypeBuilder<UserBan> builder)
    {
        builder.HasOne(ub => ub.User)
            .WithMany(u => u.Bans)
            .HasForeignKey(ub => ub.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(ub => ub.UserId)
            .IsUnique()
            .HasFilter("\"LiftedAt\" IS NULL");
    }
}
