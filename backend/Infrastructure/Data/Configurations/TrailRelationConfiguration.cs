// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailRelationConfiguration : IEntityTypeConfiguration<TrailRelation>
{
    public void Configure(EntityTypeBuilder<TrailRelation> builder)
    {
        builder.HasOne(r => r.FromTrail)
            .WithMany()
            .HasForeignKey(r => r.FromTrailId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.ToTrail)
            .WithMany()
            .HasForeignKey(r => r.ToTrailId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => new { r.FromTrailId, r.ToTrailId, r.Type })
            .IsUnique();

        // Reading a symmetric relation from the far column, and listing a parent's stages. keep-comment: why the second index exists
        builder.HasIndex(r => new { r.ToTrailId, r.Type });

        builder.ToTable(t => t.HasCheckConstraint(
            "CK_TrailRelations_NotSelf", "\"FromTrailId\" <> \"ToTrailId\""));
    }
}
