// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailContributionConfiguration : IEntityTypeConfiguration<TrailContribution>
{
    public void Configure(EntityTypeBuilder<TrailContribution> builder)
    {
        builder.HasKey(c => c.TrailId);

        builder.HasOne(c => c.ConsentText)
            .WithMany()
            .HasForeignKey(c => c.ConsentTextId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(c => c.Trail)
            .WithOne(t => t.Contribution)
            .HasForeignKey<TrailContribution>(c => c.TrailId)
            .OnDelete(DeleteBehavior.Cascade);

        // keep-comment: the trail belongs to Stigvidd once published, so deleting the account only drops the credit
        builder.HasOne(c => c.SubmittedBy)
            .WithMany()
            .HasForeignKey(c => c.SubmittedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(c => c.Likes)
            .WithOne(l => l.Contribution)
            .HasForeignKey(l => l.TrailId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
