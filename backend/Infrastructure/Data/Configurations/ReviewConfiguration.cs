// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> builder)
    {
        builder.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Named so IgnoreQueryFilters(["Moderation"]) can drop just this one. keep-comment: the name is referenced by string elsewhere
        // EF logs PossibleIncorrectRequiredNavigationWithQueryFilterInteractionWarning for ReviewImage and TrailObstacleSolvedVote because of the Moderation filters. keep-comment: deliberate warning
        // Filtering ReviewImage too would drop hidden reviews' images out of the DataTransferService backup export. keep-comment: data loss if "fixed"
        builder.HasQueryFilter("Moderation", r => r.ModerationState == ModerationState.Visible);

        builder.Property(r => r.Rating)
            .HasPrecision(3, 1);
    }
}
