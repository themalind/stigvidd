// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class MediaReprocessJob : BaseEntity
{
    public required string OptionsJson { get; set; }

    public ICollection<MediaReprocessItem> Items { get; set; } = new List<MediaReprocessItem>();
}
