// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailObstacleConfiguration : IEntityTypeConfiguration<TrailObstacle>
{
    public void Configure(EntityTypeBuilder<TrailObstacle> builder)
    {
        builder.HasOne(to => to.User)
            .WithMany()
            .HasForeignKey(to => to.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Named so IgnoreQueryFilters(["Moderation"]) can drop just this one. keep-comment: the name is referenced by string elsewhere
        builder.HasQueryFilter("Moderation", to => to.ModerationState == ModerationState.Visible);

        // A retry key is unique per user, so one user's key never blocks another's save. keep-comment: keys are client-made
        builder.HasIndex(to => new { to.UserId, to.ClientRequestId })
            .IsUnique();
    }
}
