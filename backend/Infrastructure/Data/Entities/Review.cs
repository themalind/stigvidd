// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class Review : BaseEntity
{
    public string? TrailReview { get; set; }
    public decimal Rating { get; set; }
    public int TrailId { get; set; }
    public int? UserId { get; set; }
    public ICollection<ReviewImage>? ReviewImages { get; set; }

    public Trail? Trail { get; set; }
    public User? User { get; set; }
}
