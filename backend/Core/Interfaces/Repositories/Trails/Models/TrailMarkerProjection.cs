// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Trails.Models;

internal record TrailMarkerProjection(
    string Identifier, string Name, bool IsAccessible,
    decimal? StartLatitude, decimal? StartLongitude, bool IsContribution = false);
