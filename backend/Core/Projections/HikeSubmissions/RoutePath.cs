// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Projections.HikeSubmissions;

public record RoutePath(string Identifier, string Name, RouteKind Kind, LineString GeoPath);
