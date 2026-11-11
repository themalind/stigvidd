// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.Interfaces.Repositories.Media.Models;

public record MediaReprocessItemDetail(
    string Identifier,
    string MediaIdentifier,
    string OwnerType,
    MediaReprocessItemStatus Status,
    string? LastError,
    DateTime CreatedAt,
    DateTime LastUpdatedAt);
