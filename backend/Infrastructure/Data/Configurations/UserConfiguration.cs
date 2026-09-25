// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasIndex(u => u.NickName)
            .IsUnique();

        builder.HasMany(u => u.MyWishList)
            .WithMany()
            .UsingEntity<Dictionary<string, object>>(
                "UserWishList",
                r => r.HasOne<Trail>().WithMany().HasForeignKey("TrailId"),
                l => l.HasOne<User>().WithMany().HasForeignKey("UserId"),
                j =>
                {
                    j.HasKey("UserId", "TrailId");
                    j.ToTable("UserWishList");
                });

        builder.HasMany(u => u.MyFavorites)
            .WithMany()
            .UsingEntity<Dictionary<string, object>>(
                "UserFavorites",
                r => r.HasOne<Trail>().WithMany().HasForeignKey("TrailId"),
                l => l.HasOne<User>().WithMany().HasForeignKey("UserId"),
                j =>
                {
                    j.HasKey("UserId", "TrailId");
                    j.ToTable("UserFavorites");
                });
    }
}
