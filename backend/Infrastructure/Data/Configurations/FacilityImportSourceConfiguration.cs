// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class FacilityImportSourceConfiguration : IEntityTypeConfiguration<FacilityImportSource>
{
    public void Configure(EntityTypeBuilder<FacilityImportSource> builder)
    {
        builder.Property(s => s.Name)
            .HasMaxLength(100);

        builder.Property(s => s.Slug)
            .HasMaxLength(50);

        builder.Property(s => s.Key)
            .HasMaxLength(101);

        builder.HasOne(s => s.Municipality)
            .WithMany()
            .HasForeignKey(s => s.MunicipalityId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => s.Identifier)
            .IsUnique();

        builder.HasIndex(s => s.Key)
            .IsUnique();

        builder.HasIndex(s => new { s.MunicipalityId, s.Name })
            .IsUnique();
    }
}
