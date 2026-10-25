// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class FriendNoteConfiguration : IEntityTypeConfiguration<FriendNote>
{
    public void Configure(EntityTypeBuilder<FriendNote> builder)
    {
        // NoAction on both (two cascade paths into Users is an EF error); UserRepository.DeleteUserAsync clears the rows. keep-comment: the delete path is invisible from the model
        builder.HasKey(fn => new { fn.OwnerUserId, fn.FriendUserId });

        builder.Property(fn => fn.Text).HasMaxLength(FriendNote.MaxLength);

        builder.HasOne(fn => fn.Owner)
            .WithMany()
            .HasForeignKey(fn => fn.OwnerUserId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(fn => fn.Friend)
            .WithMany()
            .HasForeignKey(fn => fn.FriendUserId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}
