// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.TrailImport.Apply;

// keep-comment: every property is null unless the merge decided to write it, so an update that changes nothing writes nothing
public record TrailUpdate(
    int TrailId,
    decimal? TrailLength,
    int? Classification,
    bool? Accessibility,
    string? AccessibilityInfo,
    string? TrailSymbol,
    LineString? GeoPath)
{
    public bool IsEmpty => TrailLength is null && Classification is null && Accessibility is null
        && AccessibilityInfo is null && TrailSymbol is null && GeoPath is null;
}
