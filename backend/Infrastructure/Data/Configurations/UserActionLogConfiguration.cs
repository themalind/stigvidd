// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class UserActionLogConfiguration : IEntityTypeConfiguration<UserActionLog>
{
    public void Configure(EntityTypeBuilder<UserActionLog> builder)
    {
        builder.HasKey(l => l.Id);
        builder.HasIndex(l => new { l.UserId, l.Action, l.CreatedAt });

        builder.HasOne(l => l.User)
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
