// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Facility;

namespace WebDataContracts.ResponseModels.CityArea;

public class CityAreaResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string Location { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? Url { get; set; }
    public required IReadOnlyCollection<FacilityResponse> Facilities { get; set; }
    public required IReadOnlyCollection<CityAreaTrailResponse> Trails { get; set; }
    public string? Municipality { get; set; }
    // keep-comment: kilometres from the caller's position to the boundary, 0 inside; null without a position or a boundary
    public double? DistanceKm { get; set; }
    // keep-comment: GeoJSON MultiPolygon coordinates, [longitude, latitude]; only for a single area
    public IReadOnlyList<IReadOnlyList<IReadOnlyList<IReadOnlyList<double>>>>? Boundary { get; set; }

    public static CityAreaResponse Create(
        string identifier,
        string name,
        string location,
        string? description,
        string? imageUrl,
        string? url,
        IReadOnlyCollection<FacilityResponse> facilities,
        IReadOnlyCollection<CityAreaTrailResponse> trails)
    {
        return new CityAreaResponse
        {
            Identifier = identifier,
            Name = name,
            Location = location,
            Description = description,
            ImageUrl = imageUrl,
            Url = url,
            Facilities = facilities,
            Trails = trails
        };
    }
}
