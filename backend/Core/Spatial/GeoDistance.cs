// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Spatial;

public static class GeoDistance
{
    private const double EarthRadiusMetres = 6371008.8;

    // keep-comment: great-circle distance between two WGS84 positions, accurate to well under a metre at trail scale
    public static double Metres(double fromLongitude, double fromLatitude, double toLongitude, double toLatitude)
    {
        var dLat = ToRadians(toLatitude - fromLatitude);
        var dLon = ToRadians(toLongitude - fromLongitude);
        var lat1 = ToRadians(fromLatitude);
        var lat2 = ToRadians(toLatitude);

        var h = Math.Pow(Math.Sin(dLat / 2), 2)
              + Math.Cos(lat1) * Math.Cos(lat2) * Math.Pow(Math.Sin(dLon / 2), 2);

        return 2 * EarthRadiusMetres * Math.Asin(Math.Sqrt(h));
    }

    private static double ToRadians(double degrees)
    {
        return degrees * Math.PI / 180;
    }
}
