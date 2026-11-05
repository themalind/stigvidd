// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.Trails;

internal record TrailMarkerProjection(
    string Identifier, string Name, bool IsAccessible,
    decimal? StartLatitude, decimal? StartLongitude, bool IsContribution = false);
