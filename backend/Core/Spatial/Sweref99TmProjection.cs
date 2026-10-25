// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Spatial;

// keep-comment: Naturvårdsverket (and other Swedish authorities) publish open trail data in SWEREF99 TM, not WGS84 — ReadGeometry needs to know when to call this.
// keep-comment: same projection as UTM zone 33N (GRS80, central meridian 15 degrees east, scale 0.9996, false easting 500000) — that equivalence is why the constants below look like a UTM zone, not a bespoke grid.
// keep-comment: no datum shift is applied — SWEREF99 sits within millimetres of WGS84, well inside this import's metre-level match tolerances.
// keep-comment: Krüger's n-series, the formulas Lantmäteriet itself publishes for this transform; verified against known SWEREF99 TM reference points, not derived from scratch.
public static class Sweref99TmProjection
{
    private const double Axis = 6378137.0;
    private const double Flattening = 1.0 / 298.257222101;
    private const double CentralMeridianDegrees = 15.0;
    private const double Scale = 0.9996;
    private const double FalseNorthing = 0.0;
    private const double FalseEasting = 500000.0;

    public static (double Longitude, double Latitude) ToWgs84(double easting, double northing)
    {
        var e2 = Flattening * (2.0 - Flattening);
        var n = Flattening / (2.0 - Flattening);
        var aRoof = Axis / (1.0 + n) * (1.0 + (n * n / 4.0) + (n * n * n * n / 64.0));

        var d1 = (n / 2.0) - (2.0 * n * n / 3.0) + (37.0 * n * n * n / 96.0) - (n * n * n * n / 360.0);
        var d2 = (n * n / 48.0) + (n * n * n / 15.0) - (437.0 * n * n * n * n / 1440.0);
        var d3 = (17.0 * n * n * n / 480.0) - (37.0 * n * n * n * n / 840.0);
        var d4 = 4397.0 * n * n * n * n / 161280.0;

        var aStar = e2 + (e2 * e2) + (e2 * e2 * e2) + (e2 * e2 * e2 * e2);
        var bStar = -((7.0 * e2 * e2) + (17.0 * e2 * e2 * e2) + (30.0 * e2 * e2 * e2 * e2)) / 6.0;
        var cStar = ((224.0 * e2 * e2 * e2) + (889.0 * e2 * e2 * e2 * e2)) / 120.0;
        var dStar = -(4279.0 * e2 * e2 * e2 * e2) / 1680.0;

        var lambdaZero = CentralMeridianDegrees * Math.PI / 180.0;

        var xi = (northing - FalseNorthing) / (Scale * aRoof);
        var eta = (easting - FalseEasting) / (Scale * aRoof);

        var xiPrime = xi
            - (d1 * Math.Sin(2.0 * xi) * Math.Cosh(2.0 * eta))
            - (d2 * Math.Sin(4.0 * xi) * Math.Cosh(4.0 * eta))
            - (d3 * Math.Sin(6.0 * xi) * Math.Cosh(6.0 * eta))
            - (d4 * Math.Sin(8.0 * xi) * Math.Cosh(8.0 * eta));

        var etaPrime = eta
            - (d1 * Math.Cos(2.0 * xi) * Math.Sinh(2.0 * eta))
            - (d2 * Math.Cos(4.0 * xi) * Math.Sinh(4.0 * eta))
            - (d3 * Math.Cos(6.0 * xi) * Math.Sinh(6.0 * eta))
            - (d4 * Math.Cos(8.0 * xi) * Math.Sinh(8.0 * eta));

        var phiStar = Math.Asin(Math.Sin(xiPrime) / Math.Cosh(etaPrime));
        var deltaLambda = Math.Atan(Math.Sinh(etaPrime) / Math.Cos(xiPrime));

        var longitudeRadians = lambdaZero + deltaLambda;
        var latitudeRadians = phiStar + (Math.Sin(phiStar) * Math.Cos(phiStar) *
            (aStar + (bStar * Math.Pow(Math.Sin(phiStar), 2)) + (cStar * Math.Pow(Math.Sin(phiStar), 4)) + (dStar * Math.Pow(Math.Sin(phiStar), 6))));

        return (longitudeRadians * 180.0 / Math.PI, latitudeRadians * 180.0 / Math.PI);
    }
}
