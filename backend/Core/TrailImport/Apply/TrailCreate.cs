// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.TrailImport.Apply;

// keep-comment: a new trail takes every source field except the name and the length, which come from the reviewer
public record TrailCreate(
    int ProposalId,
    string Name,
    decimal TrailLength,
    LineString Geometry,
    int Classification,
    bool Accessibility,
    string AccessibilityInfo,
    string TrailSymbol);
