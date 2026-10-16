// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class HikeSubmissionConfiguration : IEntityTypeConfiguration<HikeSubmission>
{
    public void Configure(EntityTypeBuilder<HikeSubmission> builder)
    {
        builder.HasIndex(s => s.Identifier)
            .IsUnique();

        // keep-comment: Pending is 0; one pending submission per hike even when two requests race past the service's check
        builder.HasIndex(s => s.SourceHikeId)
            .IsUnique()
            .HasFilter("\"Status\" = 0");

        builder.HasIndex(s => s.PublishedTrailId)
            .IsUnique();

        // keep-comment: every decision updates WHERE Status is still what was read, so a concurrent approve or reject loses
        builder.Property(s => s.Status)
            .IsConcurrencyToken();

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.SourceHike)
            .WithMany()
            .HasForeignKey(s => s.SourceHikeId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.PublishedTrail)
            .WithMany()
            .HasForeignKey(s => s.PublishedTrailId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(s => s.Images)
            .WithOne(i => i.HikeSubmission)
            .HasForeignKey(i => i.HikeSubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(s => s.TrailLength)
            .HasPrecision(18, 2);

        builder.HasOne(s => s.ConsentText)
            .WithMany()
            .HasForeignKey(s => s.ConsentTextId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
