// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ContentReportConfiguration : IEntityTypeConfiguration<ContentReport>
{
    public void Configure(EntityTypeBuilder<ContentReport> builder)
    {
        // Postgres counts NULLs as distinct, so rows left by deleted reporters do not collide. keep-comment: non-obvious uniqueness semantics
        builder.HasIndex(r => new { r.ReporterUserId, r.ContentType, r.ContentId })
            .IsUnique();

        builder.HasIndex(r => new { r.Status, r.CreatedAt });

        builder.HasIndex(r => new { r.ContentType, r.ContentId });

        builder.HasIndex(r => new { r.ContentAuthorUserId, r.Status });

        builder.HasIndex(r => new { r.ReporterUserId, r.Status });

        builder.HasOne(r => r.Reporter)
            .WithMany()
            .HasForeignKey(r => r.ReporterUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
