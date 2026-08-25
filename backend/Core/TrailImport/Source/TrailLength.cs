using NetTopologySuite.Geometries;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Core.TrailImport.Source;

// Works out how long a trail is. The Boras Stad source writes sparlangd in six shapes:
// kilometres, metres, minutes, ranges, bare numbers and nothing at all. The string is
// only trusted when it spells out its unit; everything else is measured off the
// geometry, which always knows.
public static class TrailLength
{
    // Mean Earth radius, the same figure the geometry fingerprint rounds against.
    private const double EarthRadiusMetres = 6371008.8;

    // A parsed length this far from the measured one is reported rather than stored. Set
    // wide on purpose: signs round to half kilometres, and the cases worth a human's time
    // are the ones off by a factor, not a few percent.
    private const decimal DisagreementFactor = 1.6m;

    // Built once for the process, not per call. Deliberately not RegexOptions.Compiled:
    // Parse runs once per feature, so about 200 times per import, and compiling to IL
    // costs more at that volume than interpreting saves.
    private static readonly Regex Range = new(@"\d\s*-\s*\d");
    private static readonly Regex Number = new(@"\d+(?:[.,]\d+)?");
    private static readonly Regex Kilometres = new("km", RegexOptions.IgnoreCase);
    private static readonly Regex Metres = new(@"\d\s*m\b", RegexOptions.IgnoreCase);

    /// <summary>
    /// Reads the source's own length, in kilometres, or null when it does not state a
    /// unit. Minutes, ranges and bare numbers all return null and the caller measures.
    /// </summary>
    public static decimal? Parse(string? sourceLength)
    {
        if (string.IsNullOrWhiteSpace(sourceLength))
            return null;

        var text = sourceLength.Trim();

        // "2,4 - 5,3 km" describes a network of loops rather than this feature: the five
        // rows carrying it measure anywhere from 0,48 to 5,73 km. It ends in "km", so it
        // has to be rejected before the unit is looked at.
        if (Range.IsMatch(text))
            return null;

        var number = Number.Match(text);
        if (!number.Success)
            return null;

        if (!decimal.TryParse(number.Value.Replace(',', '.'), NumberStyles.Number,
                CultureInfo.InvariantCulture, out var value))
            return null;

        if (Kilometres.IsMatch(text))
            return Round(value);

        if (Metres.IsMatch(text))
            return Round(value / 1000m);

        return null;
    }

    /// <summary>Measures the line along the Earth's surface, in kilometres.</summary>
    public static decimal FromGeometry(LineString? geometry)
    {
        ArgumentNullException.ThrowIfNull(geometry);

        var coordinates = geometry.Coordinates;
        var metres = 0.0;

        for (var i = 1; i < coordinates.Length; i++)
            metres += Haversine(coordinates[i - 1], coordinates[i]);

        return Round((decimal)(metres / 1000));
    }

    /// <summary>
    /// True when the source's figure is too far from the measured one to be taken at face
    /// value. Flags a bad length and broken geometry alike, which is the point.
    /// </summary>
    public static bool Disagrees(decimal parsed, decimal measured)
    {
        if (parsed <= 0 || measured <= 0)
            return true;

        var ratio = parsed / measured;

        return ratio > DisagreementFactor || ratio < 1 / DisagreementFactor;
    }

    private static double Haversine(Coordinate from, Coordinate to)
    {
        var dLat = ToRadians(to.Y - from.Y);
        var dLon = ToRadians(to.X - from.X);
        var lat1 = ToRadians(from.Y);
        var lat2 = ToRadians(to.Y);

        var h = Math.Pow(Math.Sin(dLat / 2), 2)
              + Math.Cos(lat1) * Math.Cos(lat2) * Math.Pow(Math.Sin(dLon / 2), 2);

        return 2 * EarthRadiusMetres * Math.Asin(Math.Sqrt(h));
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;

    private static decimal Round(decimal kilometres) =>
        Math.Round(kilometres, 2, MidpointRounding.AwayFromZero);
}
