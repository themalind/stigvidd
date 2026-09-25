// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailConfiguration : IEntityTypeConfiguration<Trail>
{
    public void Configure(EntityTypeBuilder<Trail> builder)
    {
        // VisitorInformation holds the TrailId FK; the Trail table has no VisitorInformationId. keep-comment: the dependent side is not visible from the navigation
        builder.HasOne(t => t.VisitorInformation)
            .WithOne()
            .HasForeignKey<VisitorInformation>("TrailId")
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.Identifier)
            .IsUnique();

        builder.Property(t => t.TrailLength)
            .HasPrecision(18, 2);
    }
}
