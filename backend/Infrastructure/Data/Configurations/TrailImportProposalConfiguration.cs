// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailImportProposalConfiguration : IEntityTypeConfiguration<TrailImportProposal>
{
    public void Configure(EntityTypeBuilder<TrailImportProposal> builder)
    {
        builder.HasOne(p => p.Session)
            .WithMany(s => s.Proposals)
            .HasForeignKey(p => p.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(p => p.FeatureProperties)
            .HasColumnType("jsonb");

        builder.Property(p => p.DecidedLengthKm)
            .HasPrecision(18, 2);
    }
}
