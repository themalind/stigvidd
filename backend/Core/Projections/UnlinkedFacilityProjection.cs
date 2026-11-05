// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Projections;

public record UnlinkedFacilityProjection(string Identifier, string Name, int FacilityType, double? Latitude, double? Longitude);
