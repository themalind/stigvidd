// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: keyed on the contribution, not the trail, so a curated trail cannot be liked
public class TrailContributionLike
{
    public int TrailId { get; set; }
    public TrailContribution? Contribution { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
