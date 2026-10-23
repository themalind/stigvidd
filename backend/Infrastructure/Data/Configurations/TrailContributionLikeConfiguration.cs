// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailContributionLikeConfiguration : IEntityTypeConfiguration<TrailContributionLike>
{
    public void Configure(EntityTypeBuilder<TrailContributionLike> builder)
    {
        builder.HasKey(l => new { l.TrailId, l.UserId });

        builder.HasOne(l => l.User)
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
