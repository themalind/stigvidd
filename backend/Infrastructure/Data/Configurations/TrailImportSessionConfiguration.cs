// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailImportSessionConfiguration : IEntityTypeConfiguration<TrailImportSession>
{
    public void Configure(EntityTypeBuilder<TrailImportSession> builder)
    {
        builder.HasIndex(s => new { s.Source, s.FileHash });

        builder.Property(s => s.ApplyReport)
            .HasColumnType("jsonb");
    }
}
