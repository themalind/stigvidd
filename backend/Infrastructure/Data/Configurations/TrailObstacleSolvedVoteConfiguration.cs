// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TrailObstacleSolvedVoteConfiguration : IEntityTypeConfiguration<TrailObstacleSolvedVote>
{
    public void Configure(EntityTypeBuilder<TrailObstacleSolvedVote> builder)
    {
        builder.HasIndex(v => new { v.TrailObstacleId, v.UserId })
            .IsUnique();

        builder.HasOne(solvedVote => solvedVote.TrailObstacle)
            .WithMany(to => to.SolvedVotes)
            .HasForeignKey(solvedVote => solvedVote.TrailObstacleId)
            .OnDelete(DeleteBehavior.NoAction);

        builder.HasOne(solvedVote => solvedVote.User)
            .WithMany()
            .HasForeignKey(solvedVote => solvedVote.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
