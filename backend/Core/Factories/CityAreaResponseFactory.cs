// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.CityArea;
using WebDataContracts.ResponseModels.Facility;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Factories;

public class CityAreaResponseFactory
{
    public string PresentableBaseUrl { get; }

    public CityAreaResponseFactory(IConfiguration configuration)
    {
        PresentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public CityAreaResponse Create(CityAreaProjection cityArea)
    {
        var facilities = cityArea.Facilities
            .Select(facility => FacilityResponse.Create(
                facility.Identifier,
                facility.Name,
                facility.FacilityType,
                facility.IsAccessible,
                null,
                null,
                facility.Location,
                facility.Description,
                facility.Url))
            .ToList();

        var trails = cityArea.Trails
            .Select(trail => CityAreaTrailResponse.Create(
                trail.Identifier,
                trail.Name,
                trail.TrailLength,
                trail.Classification,
                trail.Description,
                trail.AverageRating,
                trail.Image != null
                    ? TrailImageResponse.Create(PresentableBaseUrl, trail.Image.Identifier, trail.Image.ImageUrl)
                    : null))
            .ToList();

        return CityAreaResponse.Create(
            cityArea.Identifier,
            cityArea.Name,
            cityArea.Location,
            cityArea.Description,
            cityArea.ImageUrl,
            cityArea.Url,
            facilities,
            trails);
    }

    public IReadOnlyCollection<CityAreaResponse> Create(IReadOnlyCollection<CityAreaProjection> cityAreas)
    {
        return cityAreas.Select(Create).ToList();
    }

    public AdminLinkSuggestionsResponse CreateLinkSuggestions(
        IReadOnlyCollection<SuggestedFacility> facilities, IReadOnlyCollection<SuggestedTrail> trails)
    {
        return new AdminLinkSuggestionsResponse
        {
            Facilities = facilities
                .Select(f => new AdminUnlinkedFacilityResponse
                {
                    Identifier = f.Facility.Identifier,
                    Name = f.Facility.Name,
                    FacilityType = f.Facility.FacilityType,
                    Suggestions = CreateSuggestions(f.Suggestions)
                })
                .ToList(),
            Trails = trails
                .Select(t => new AdminUnlinkedTrailResponse
                {
                    Identifier = t.Trail.Identifier,
                    Name = t.Trail.Name,
                    City = t.Trail.City,
                    IsVerified = t.Trail.IsVerified,
                    Suggestions = CreateSuggestions(t.Suggestions)
                })
                .ToList()
        };
    }

    private static IReadOnlyCollection<AdminAreaSuggestionResponse> CreateSuggestions(IReadOnlyList<AreaSuggestion> suggestions)
    {
        return suggestions
            .Select(suggestion => new AdminAreaSuggestionResponse
            {
                AreaIdentifier = suggestion.AreaIdentifier,
                AreaName = suggestion.AreaName,
                Reason = suggestion.Reason,
                DistanceKm = suggestion.DistanceKm is double km ? Math.Round(km, 1) : null,
                NearestName = suggestion.NearestName
            })
            .ToList();
    }

    public IReadOnlyCollection<AdminCityAreaResponse> CreateAdmin(IReadOnlyCollection<AdminCityAreaProjection> cityAreas)
    {
        return cityAreas
            .Select(area => new AdminCityAreaResponse
            {
                Identifier = area.Identifier,
                Name = area.Name,
                Location = area.Location,
                Facilities = area.Facilities
                    .Select(f => new AdminCityAreaFacilityResponse
                    {
                        Identifier = f.Identifier,
                        Name = f.Name,
                        FacilityType = f.FacilityType
                    })
                    .ToList(),
                Trails = area.Trails
                    .Select(t => new AdminCityAreaTrailResponse
                    {
                        Identifier = t.Identifier,
                        Name = t.Name,
                        IsVerified = t.IsVerified
                    })
                    .ToList()
            })
            .ToList();
    }
}
