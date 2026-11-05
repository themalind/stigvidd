// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections.CityAreas;

public record UnlinkedTrailProjection(
    string Identifier, string Name, string City, bool IsVerified, double? Latitude, double? Longitude);
