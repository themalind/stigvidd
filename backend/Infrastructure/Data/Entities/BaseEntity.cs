// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public abstract class BaseEntity
{
    public int Id { get; set; }
    public string Identifier { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; set; }
    public DateTime LastUpdatedAt { get; set; }

    // One clock reading: ReviewResponseFactory.EditedAt reads LastUpdatedAt > CreatedAt as an edit. keep-comment: invariant another file relies on
    protected BaseEntity()
    {
        var now = DateTime.UtcNow;
        CreatedAt = now;
        LastUpdatedAt = now;
    }
}
