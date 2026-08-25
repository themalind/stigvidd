using NetTopologySuite.Geometries;
using System.Globalization;
using System.Security.Cryptography;

namespace Core.TrailImport.Matching;

// Identifies a trail geometry by its shape, because the source's own properties.id is
// not stable between exports. Hashes the whole coordinate list at fixed precision;
// the direction the line was digitised in is normalised away, so a line and its
// reverse produce the same fingerprint.
public static class GeometryFingerprint
{
    // ~1 cm at Swedish latitudes, finer than the source publishes.
    private const int Decimals = 7;

    public static string Compute(LineString? geometry)
    {
        ArgumentNullException.ThrowIfNull(geometry);

        if (geometry.IsEmpty)
            throw new ArgumentException("Cannot fingerprint an empty geometry.", nameof(geometry));

        var coordinates = geometry.Coordinates;
        var reversed = ShouldReverse(coordinates);

        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);

        // A whole trail can run to 70 000 points, so the loop formats straight into a
        // stack buffer instead of allocating a string and a byte array per coordinate.
        Span<byte> buffer = stackalloc byte[64];

        for (var i = 0; i < coordinates.Length; i++)
        {
            var c = coordinates[reversed ? coordinates.Length - 1 - i : i];

            var written = Write(buffer, c.X);
            buffer[written++] = (byte)',';
            written += Write(buffer[written..], c.Y);
            buffer[written++] = (byte)';';

            hash.AppendData(buffer[..written]);
        }

        return Convert.ToHexStringLower(hash.GetHashAndReset());
    }

    // Hash the line from whichever end sorts first, so orientation cannot change the result.
    private static bool ShouldReverse(Coordinate[] coordinates)
    {
        for (var i = 0; i < coordinates.Length; i++)
        {
            var comparison = Compare(coordinates[i], coordinates[^(i + 1)]);

            if (comparison != 0)
                return comparison > 0;
        }

        return false;
    }

    private static int Compare(Coordinate left, Coordinate right)
    {
        var x = Round(left.X).CompareTo(Round(right.X));

        return x != 0 ? x : Round(left.Y).CompareTo(Round(right.Y));
    }

    private static double Round(double value) => Math.Round(value, Decimals, MidpointRounding.AwayFromZero);

    // Writes the rounded ordinate as UTF-8 and reports how many bytes it took. "F7" and
    // the invariant culture are what make the digest reproducible: a Swedish culture
    // would write a comma and change every fingerprint.
    private static int Write(Span<byte> destination, double value)
    {
        if (!Round(value).TryFormat(destination, out var written, "F7", CultureInfo.InvariantCulture))
            throw new InvalidOperationException($"Coordinate {value} did not fit the format buffer.");

        return written;
    }
}
