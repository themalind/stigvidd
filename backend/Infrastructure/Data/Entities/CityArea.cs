// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using NetTopologySuite.Geometries;

namespace Infrastructure.Data.Entities;

public class CityArea: BaseEntity
{
    public required string Name { get; set; }
    public required string Location { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string? Url { get; set; }
    // keep-comment: what lies inside is linked by recalculation; an area without one keeps only its manual links
    public MultiPolygon? Boundary { get; set; }
    public int? MunicipalityId { get; set; }
    public Municipality? Municipality { get; set; }

    public ICollection<Trail>? Trails { get; set; }
    public ICollection<Facility>? Facilities { get; set; }
}
