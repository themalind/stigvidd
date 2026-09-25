// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class UserBlockConfiguration : IEntityTypeConfiguration<UserBlock>
{
    public void Configure(EntityTypeBuilder<UserBlock> builder)
    {
        // NoAction on both (two cascade paths into Users is an EF error); UserRepository.DeleteUserAsync clears the rows. keep-comment: the delete path is invisible from the model
        builder.HasKey(ub => new { ub.BlockerUserId, ub.BlockedUserId });

        builder.HasOne(ub => ub.Blocker)
            .WithMany()
            .HasForeignKey(ub => ub.BlockerUserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(ub => ub.Blocked)
            .WithMany()
            .HasForeignKey(ub => ub.BlockedUserId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
