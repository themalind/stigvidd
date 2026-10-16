// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class HikeSubmissionImageConfiguration : IEntityTypeConfiguration<HikeSubmissionImage>
{
    public void Configure(EntityTypeBuilder<HikeSubmissionImage> builder)
    {
        builder.HasOne(i => i.SourceHikeImage)
            .WithMany()
            .HasForeignKey(i => i.SourceHikeImageId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
