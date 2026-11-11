// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Interfaces.Repositories.Hikes.Models;

public record RoutePath(string Identifier, string Name, RouteKind Kind, LineString GeoPath);
