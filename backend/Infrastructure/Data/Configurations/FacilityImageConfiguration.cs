// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class FacilityImageConfiguration : IEntityTypeConfiguration<FacilityImage>
{
    public void Configure(EntityTypeBuilder<FacilityImage> builder)
    {
        builder.HasOne(fi => fi.Facility)
            .WithMany(f => f.Images)
            .HasForeignKey(fi => fi.FacilityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(fi => fi.Identifier)
            .IsUnique();
    }
}
