// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class Municipality : BaseEntity
{
    public required string Name { get; set; }
    // keep-comment: the name in lowercase ASCII, e.g. "boras"; it prefixes imported source ids, so it never changes
    public required string Slug { get; set; }
}
