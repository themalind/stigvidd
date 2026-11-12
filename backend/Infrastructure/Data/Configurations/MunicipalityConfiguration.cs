// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class MunicipalityConfiguration : IEntityTypeConfiguration<Municipality>
{
    public void Configure(EntityTypeBuilder<Municipality> builder)
    {
        builder.Property(m => m.Name)
            .HasMaxLength(100);

        builder.Property(m => m.Slug)
            .HasMaxLength(50);

        builder.HasIndex(m => m.Identifier)
            .IsUnique();

        builder.HasIndex(m => m.Name)
            .IsUnique();

        builder.HasIndex(m => m.Slug)
            .IsUnique();
    }
}
