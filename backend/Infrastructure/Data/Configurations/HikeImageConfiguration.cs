// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class HikeImageConfiguration : IEntityTypeConfiguration<HikeImage>
{
    public void Configure(EntityTypeBuilder<HikeImage> builder)
    {
        builder.HasOne(hi => hi.Hike)
            .WithMany(h => h.Images)
            .HasForeignKey(hi => hi.HikeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
