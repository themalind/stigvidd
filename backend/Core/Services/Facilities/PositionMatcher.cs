// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Infrastructure.Enums;

namespace Core.Services.Facilities;

// keep-comment: for a file without stable ids, a site within the radius of an earlier import of the same type is that facility
public static class PositionMatcher
{
    public const double MatchRadiusMetres = 25;

    public static List<SourceFacility> Match(
        IReadOnlyCollection<SourceFacility> sites, IReadOnlyDictionary<string, Facility> imported)
    {
        var pairs = new List<(string SiteId, string SourceId, double Metres)>();
        var positions = new List<(string SourceId, FacilityType Type, double Longitude, double Latitude)>();

        foreach (var (sourceId, facility) in imported)
        {
            if (TryPosition(facility, out var longitude, out var latitude))
                positions.Add((sourceId, facility.FacilityType, longitude, latitude));
        }

        foreach (var site in sites)
        {
            foreach (var (sourceId, type, longitude, latitude) in positions)
            {
                if ((type & site.Type) == 0)
                    continue;

                var metres = GeoDistance.Metres(site.Longitude, site.Latitude, longitude, latitude);

                if (metres <= MatchRadiusMetres)
                    pairs.Add((site.SourceId, sourceId, metres));
            }
        }

        // keep-comment: closest pairs first, so two fire pits a few metres apart each keep their own facility
        var matched = new Dictionary<string, string>(StringComparer.Ordinal);
        var claimed = new HashSet<string>(StringComparer.Ordinal);

        foreach (var (siteId, sourceId, _) in pairs.OrderBy(p => p.Metres))
        {
            if (!matched.ContainsKey(siteId) && claimed.Add(sourceId))
                matched[siteId] = sourceId;
        }

        var taken = new HashSet<string>(imported.Keys, StringComparer.Ordinal);
        var result = new List<SourceFacility>();

        foreach (var site in sites)
        {
            if (matched.TryGetValue(site.SourceId, out var sourceId))
            {
                result.Add(site with { SourceId = sourceId });
                continue;
            }

            var unique = FacilityFileReader.UniqueId(site.SourceId, taken);
            taken.Add(unique);
            result.Add(site with { SourceId = unique });
        }

        return result;
    }

    // keep-comment: where the file last put it, so a facility moved by hand here is still recognised
    private static bool TryPosition(Facility facility, out double longitude, out double latitude)
    {
        if (FacilitySourceSnapshot.Parse(facility.SourceSnapshot) is { } baseline && baseline.TryPoint(out longitude, out latitude))
            return true;

        longitude = facility.Coordinates?.X ?? 0;
        latitude = facility.Coordinates?.Y ?? 0;

        return facility.Coordinates is not null;
    }
}
