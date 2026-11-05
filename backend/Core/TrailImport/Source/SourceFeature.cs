// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.TrailImport.Source;

// keep-comment: one feature as the source published it, before anything has been decided about it
public sealed record SourceFeature(string ExternalId, string Name, string Properties, LineString Geometry);
