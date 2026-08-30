// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class TrailLink : BaseEntity
{
    public required string Link { get; set; }
    public int TrailId { get; set; }
    public required string Title { get; set; }

    public Trail? Trail { get; set; }
}