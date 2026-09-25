// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class UserPushTokenConfiguration : IEntityTypeConfiguration<UserPushToken>
{
    public void Configure(EntityTypeBuilder<UserPushToken> builder)
    {
        builder.HasOne(upt => upt.User)
            .WithMany()
            .HasForeignKey(upt => upt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(upt => upt.ExpoToken)
            .IsUnique();
    }
}
