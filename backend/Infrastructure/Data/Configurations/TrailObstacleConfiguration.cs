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
    }
}
