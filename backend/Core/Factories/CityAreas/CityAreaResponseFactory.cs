// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Services;
using Microsoft.Extensions.Configuration;
using NetTopologySuite.Geometries;
using WebDataContracts.ResponseModels.CityArea;
using WebDataContracts.ResponseModels.Facility;
using WebDataContracts.ResponseModels.Trail;

namespace Core.Factories.CityAreas;

public class CityAreaResponseFactory
{
    private const double PathToleranceMetres = 5;

    public string PresentableBaseUrl { get; }

    public CityAreaResponseFactory(IConfiguration configuration)
    {
        PresentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    // keep-comment: shapes (boundary, trail paths) are for the single-area page, so the list stays light
    public CityAreaResponse Create(CityAreaProjection cityArea, double? distanceKm, bool includeShapes)
    {
        var facilities = cityArea.Facilities
            .Select(facility => FacilityResponse.Create(
                facility.Identifier,
                facility.Name,
                facility.FacilityType,
                facility.IsAccessible,
                GeoPointFactory.ToLatitude(facility.Coordinates),
                GeoPointFactory.ToLongitude(facility.Coordinates),
                facility.Location,
                facility.Description,
                facility.Url))
            .ToList();

        var trails = cityArea.Trails
            .Select(trail =>
            {
                var response = CityAreaTrailResponse.Create(
                    trail.Identifier,
                    trail.Name,
                    trail.TrailLength,
                    trail.Classification,
                    trail.Description,
                    trail.AverageRating,
                    trail.Image != null
                        ? TrailImageResponse.Create(PresentableBaseUrl, trail.Image.Identifier, trail.Image.ImageUrl)
                        : null);
                response.IsAccessible = trail.IsAccessible;
                response.Path = includeShapes && trail.Path is { } path ? SimplifiedPath(path) : null;
                return response;
            })
            .ToList();

        var area = CityAreaResponse.Create(
            cityArea.Identifier,
            cityArea.Name,
            cityArea.Location,
            cityArea.Description,
            cityArea.ImageUrl,
            cityArea.Url,
            facilities,
            trails);
        area.Municipality = cityArea.Municipality;
        area.DistanceKm = distanceKm is double km ? Math.Round(km, 1) : null;
        area.Boundary = includeShapes && cityArea.Boundary is { } boundary ? GeoPolygonSerializer.ToCoordinates(boundary) : null;

        return area;
    }

    public AdminCityAreaBoundaryPreviewResponse CreateBoundaryPreview(BoundaryPreviewProjection preview)
    {
        return new AdminCityAreaBoundaryPreviewResponse
        {
            AddedTrails = [.. preview.AddedTrails.Select(CreatePreviewTrail)],
            RemovedTrails = [.. preview.RemovedTrails.Select(CreatePreviewTrail)],
            AddedFacilities = [.. preview.AddedFacilities.Select(CreatePreviewFacility)],
            RemovedFacilities = [.. preview.RemovedFacilities.Select(CreatePreviewFacility)],
        };
    }

    public IReadOnlyCollection<AdminCityAreaTrailPathResponse> CreateTrailPaths(IReadOnlyCollection<AreaTrailPathProjection> trails)
    {
        return [.. trails.Select(trail => new AdminCityAreaTrailPathResponse
        {
            Identifier = trail.Identifier,
            Path = SimplifiedPath(trail.Path),
        })];
    }

    public AdminCityAreaBoundaryResponse CreateBoundary(MultiPolygon boundary)
    {
        return new AdminCityAreaBoundaryResponse { Coordinates = GeoPolygonSerializer.ToCoordinates(boundary) };
    }

    public AdminCityAreaRecalculationResponse CreateRecalculation(int areaCount)
    {
        return new AdminCityAreaRecalculationResponse { AreaCount = areaCount };
    }

    private static AdminCityAreaPreviewTrailResponse CreatePreviewTrail(PreviewTrailProjection trail)
    {
        return new AdminCityAreaPreviewTrailResponse
        {
            Identifier = trail.Identifier,
            Name = trail.Name,
            ShareInside = trail.ShareInside,
            Path = SimplifiedPath(trail.Path),
        };
    }

    private static AdminCityAreaPreviewFacilityResponse CreatePreviewFacility(PreviewFacilityProjection facility)
    {
        return new AdminCityAreaPreviewFacilityResponse
        {
            Identifier = facility.Identifier,
            Name = facility.Name,
            Longitude = facility.Coordinates.X,
            Latitude = facility.Coordinates.Y,
        };
    }

    private static IReadOnlyList<double[]> SimplifiedPath(LineString path)
    {
        return GeoPathSerializer.ToCoordinatePairs(PathSimplifier.Simplify(path, PathToleranceMetres));
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
                MunicipalityIdentifier = area.MunicipalityIdentifier,
                Boundary = area.Boundary is { } boundary ? GeoPolygonSerializer.ToCoordinates(boundary) : null,
                Facilities = area.Facilities.Select(CreateAdminFacility).ToList(),
                Trails = area.Trails.Select(CreateAdminTrail).ToList(),
                ExcludedFacilities = area.ExcludedFacilities.Select(CreateAdminFacility).ToList(),
                ExcludedTrails = area.ExcludedTrails.Select(CreateAdminTrail).ToList(),
            })
            .ToList();
    }

    private static AdminCityAreaFacilityResponse CreateAdminFacility(AdminCityAreaFacilityProjection facility)
    {
        return new AdminCityAreaFacilityResponse
        {
            Identifier = facility.Identifier,
            Name = facility.Name,
            FacilityType = facility.FacilityType,
            IsManual = facility.IsManual,
        };
    }

    private static AdminCityAreaTrailResponse CreateAdminTrail(AdminCityAreaTrailProjection trail)
    {
        return new AdminCityAreaTrailResponse
        {
            Identifier = trail.Identifier,
            Name = trail.Name,
            IsVerified = trail.IsVerified,
            IsManual = trail.IsManual,
        };
    }
}
