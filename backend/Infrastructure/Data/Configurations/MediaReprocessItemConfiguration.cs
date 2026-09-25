// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class MediaReprocessItemConfiguration : IEntityTypeConfiguration<MediaReprocessItem>
{
    public void Configure(EntityTypeBuilder<MediaReprocessItem> builder)
    {
        builder.HasOne(i => i.Job)
            .WithMany(j => j.Items)
            .HasForeignKey(i => i.JobId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(i => i.Status);
    }
}
