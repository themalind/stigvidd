// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Text.RegularExpressions;
using Core.Spatial;
using NetTopologySuite.Geometries;
using WebDataContracts.Enums;

namespace Core.Services.CityAreas;

public static partial class CityAreaSuggester
{
    public const double NearbyKm = 5.0;
    public const int MaxSuggestions = 3;
    private const int MinimumNamePart = 4;

    // keep-comment: areas named in the item's name come first, then areas with a linked place within NearbyKm, closest first
    public static IReadOnlyList<AreaSuggestion> Suggest(
        string name, double? latitude, double? longitude, IReadOnlyCollection<SuggestionAreaProjection> areas)
    {
        var distances = latitude is double lat && longitude is double lon
            ? ClosestPlaces(areas, lat, lon)
            : [];

        var named = areas
            .Select(area => (Area: area, Length: LongestNamedPart(area.Name, name)))
            .Where(x => x.Length > 0)
            .OrderByDescending(x => x.Length)
            .Select(x =>
            {
                var place = distances.FirstOrDefault(d => d.Area == x.Area);
                return new AreaSuggestion(
                    x.Area.Identifier, x.Area.Name, AreaSuggestionReason.Name, place?.Km, place?.PlaceName);
            });

        var nearby = distances
            .Where(d => d.Km <= NearbyKm)
            .OrderBy(d => d.Km)
            .Select(d => new AreaSuggestion(
                d.Area.Identifier, d.Area.Name, AreaSuggestionReason.Nearby, d.Km, d.PlaceName));

        return named
            .Concat(nearby)
            .DistinctBy(s => s.AreaIdentifier)
            .Take(MaxSuggestions)
            .ToList();
    }

    private record AreaDistance(SuggestionAreaProjection Area, string PlaceName, double Km);

    private static List<AreaDistance> ClosestPlaces(
        IReadOnlyCollection<SuggestionAreaProjection> areas, double latitude, double longitude)
    {
        var projection = LocalMetricProjection.CentredOn(new Coordinate(longitude, latitude));

        return areas
            .SelectMany(area => area.Places.Select(place =>
            {
                var easting = (place.Longitude - longitude) * projection.MetresPerDegreeLongitude;
                var northing = (place.Latitude - latitude) * projection.MetresPerDegreeLatitude;
                return new AreaDistance(area, place.Name, Math.Sqrt((easting * easting) + (northing * northing)) / 1000.0);
            }))
            .GroupBy(d => d.Area)
            .Select(group => group.MinBy(d => d.Km))
            .OfType<AreaDistance>()
            .ToList();
    }

    // keep-comment: "Byttorp, Kolbränningen" and "Hofsnäs och Torpa" are matched part by part, as whole words
    private static int LongestNamedPart(string areaName, string itemName)
    {
        return NamePartSeparator().Split(areaName)
            .Select(part => part.Trim())
            .Where(part => part.Length >= MinimumNamePart)
            .Where(part => ContainsWord(itemName, part))
            .Select(part => part.Length)
            .DefaultIfEmpty(0)
            .Max();
    }

    private static bool ContainsWord(string text, string word)
    {
        for (var at = text.IndexOf(word, StringComparison.OrdinalIgnoreCase);
             at >= 0;
             at = text.IndexOf(word, at + 1, StringComparison.OrdinalIgnoreCase))
        {
            var end = at + word.Length;
            var startsWord = at == 0 || !char.IsLetterOrDigit(text[at - 1]);
            var endsWord = end == text.Length || !char.IsLetterOrDigit(text[end]);

            if (startsWord && endsWord)
            {
                return true;
            }
        }

        return false;
    }

    [GeneratedRegex(@",|\soch\s")]
    private static partial Regex NamePartSeparator();
}
