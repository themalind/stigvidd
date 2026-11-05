// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Factories;

public class FacilityResponseFactory
{
    // keep-comment: the public shape reports a coordinate-less facility as 0/0, which shipped apps rely on;
    // keep-comment: the admin shape (CreateAdmin) reports null instead
    public FacilityResponse Create(Facility facility)
    {
        return FacilityResponse.Create(
            facility.Identifier,
            facility.Name,
            (int)facility.FacilityType,
            facility.IsAccessible,
            GeoPointFactory.ToLatitude(facility.Coordinates).GetValueOrDefault(),
            GeoPointFactory.ToLongitude(facility.Coordinates).GetValueOrDefault(),
            facility.Location,
            facility.Description,
            facility.Url
        );
    }

    public AdminFacilityResponse CreateAdmin(Facility facility)
    {
        return new AdminFacilityResponse
        {
            Identifier = facility.Identifier,
            Name = facility.Name,
            FacilityType = (int)facility.FacilityType,
            IsAccessible = facility.IsAccessible,
            Latitude = GeoPointFactory.ToLatitude(facility.Coordinates),
            Longitude = GeoPointFactory.ToLongitude(facility.Coordinates),
            Location = facility.Location ?? string.Empty,
            Description = facility.Description ?? string.Empty,
            Url = facility.Url ?? string.Empty,
        };
    }

    public IReadOnlyCollection<FacilityResponse> Create(IReadOnlyCollection<Facility> facilities)
    {
        return facilities.Select(facility => FacilityResponse.Create(
            facility.Identifier,
            facility.Name,
            (int)facility.FacilityType,
            facility.IsAccessible,
            GeoPointFactory.ToLatitude(facility.Coordinates).GetValueOrDefault(),
            GeoPointFactory.ToLongitude(facility.Coordinates).GetValueOrDefault(),
            facility.Location,
            facility.Description,
            facility.Url
        )).ToList();
    }
}
