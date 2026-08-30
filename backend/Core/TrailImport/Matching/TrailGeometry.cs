// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.TrailImport.Matching;
using NetTopologySuite.Geometries;

namespace Core.TrailImport.Matching;

// A trail reduced to what the matcher needs. Loading all of them once per import is far
// cheaper than querying per feature, and the whole set fits comfortably in memory.
public sealed record TrailGeometry(int TrailId, LineString Geometry);
