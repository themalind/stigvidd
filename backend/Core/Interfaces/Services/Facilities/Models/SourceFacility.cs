// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.Interfaces.Services.Facilities.Models;

public record SourceFacility(
    string SourceId,
    string Name,
    string? Description,
    string? Url,
    double Longitude,
    double Latitude,
    FacilityType Type);
