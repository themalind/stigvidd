// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Core.Interfaces.Repositories.CityAreas.Models;

public record PreviewTrailProjection(string Identifier, string Name, LineString Path, double ShareInside);
