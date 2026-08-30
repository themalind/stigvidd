// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using ImageMagick;

namespace IntegrationTests;

/// <summary>
/// Decodable image bytes for the upload endpoints.
/// </summary>
public static class TestImages
{
    public static byte[] Jpeg(uint width = 200, uint height = 150)
    {
        using var image = new MagickImage(new MagickColor("#3366cc"), width, height);
        image.Format = MagickFormat.Jpeg;
        return image.ToByteArray();
    }

    /// <summary>
    /// A JPEG carrying the EXIF a phone camera writes, GPS included.
    /// </summary>
    public static byte[] JpegWithGps(uint width = 200, uint height = 150)
    {
        using var image = new MagickImage(new MagickColor("#3366cc"), width, height);

        var exif = new ExifProfile();
        exif.SetValue(ExifTag.Make, "TestPhone");
        exif.SetValue(ExifTag.GPSLatitudeRef, "N");
        exif.SetValue(ExifTag.GPSLatitude, [new Rational(57), new Rational(37), new Rational(0)]);
        exif.SetValue(ExifTag.GPSLongitudeRef, "E");
        exif.SetValue(ExifTag.GPSLongitude, [new Rational(12), new Rational(48), new Rational(0)]);
        image.SetProfile(exif);

        image.Format = MagickFormat.Jpeg;
        return image.ToByteArray();
    }

    public static bool HasExif(byte[] bytes)
    {
        using var image = new MagickImage(bytes);
        return image.GetExifProfile() != null;
    }
}
