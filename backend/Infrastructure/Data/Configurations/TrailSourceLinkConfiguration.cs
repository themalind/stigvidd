// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailSourceLinkConfiguration : IEntityTypeConfiguration<TrailSourceLink>
{
    public void Configure(EntityTypeBuilder<TrailSourceLink> builder)
    {
        // SetNull: the link outlives the trail, so a deleted trail is not recreated by the next sync. keep-comment: why not Cascade
        builder.HasOne(l => l.Trail)
            .WithMany(t => t.SourceLinks)
            .HasForeignKey(l => l.TrailId)
            .OnDelete(DeleteBehavior.SetNull);

        // The sync matches on the fingerprint, not the external id. keep-comment: the source's ids are unstable between exports
        builder.HasIndex(l => new { l.Source, l.GeometryFingerprint })
            .IsUnique();

        builder.HasIndex(l => new { l.Source, l.LastSeenExternalId });

        builder.Property(l => l.SourceSnapshot)
            .HasColumnType("jsonb");
    }
}
