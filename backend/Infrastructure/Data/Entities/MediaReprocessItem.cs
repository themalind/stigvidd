// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

public class MediaReprocessItem : BaseEntity
{
    public int JobId { get; set; }
    public MediaReprocessJob? Job { get; set; }

    public required string MediaIdentifier { get; set; }
    public required string OwnerType { get; set; }

    public MediaReprocessItemStatus Status { get; set; }
    public string? LastError { get; set; }
}
