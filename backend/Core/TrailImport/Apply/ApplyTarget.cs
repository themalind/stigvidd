// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.TrailImport.Apply;

// keep-comment: the trail as it stands before the apply, which the three-way merge compares against
public record ApplyTarget(
    int TrailId,
    string Name,
    int Classification,
    bool Accessibility,
    string AccessibilityInfo,
    string TrailSymbol,
    LineString? GeoPath);
