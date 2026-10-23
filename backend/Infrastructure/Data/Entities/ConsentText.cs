// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

// keep-comment: rows are never edited or deleted; a changed wording is a new Version, added by a migration
public class ConsentText
{
    public int Id { get; set; }
    public required string Kind { get; set; }
    public required string Version { get; set; }
    public required string Locale { get; set; }
    public required string Text { get; set; }
    public DateTime CreatedAt { get; set; }
}
