// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class HikeShareConfiguration : IEntityTypeConfiguration<HikeShare>
{
    public void Configure(EntityTypeBuilder<HikeShare> builder)
    {
        builder.HasKey(hs => new { hs.HikeId, hs.SharedWithId });

        builder.HasOne(hs => hs.Hike)
            .WithMany()
            .HasForeignKey(hs => hs.HikeId)
            .OnDelete(DeleteBehavior.Cascade);

        // NoAction; the service removes these rows on user delete. keep-comment: the delete path is invisible from the model
        builder.HasOne(hs => hs.SharedWith)
            .WithMany()
            .HasForeignKey(hs => hs.SharedWithId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(hs => hs.SharedBy)
            .WithMany()
            .HasForeignKey(hs => hs.SharedById)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
