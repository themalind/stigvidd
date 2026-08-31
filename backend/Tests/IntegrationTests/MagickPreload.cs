// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

#if !WINDOWS
using ImageMagick;
using System.Runtime.CompilerServices;

namespace IntegrationTests;

internal static class MagickPreload
{
    // Binds Magick's JPEG symbols to its own bundled libjpeg (6.2 ABI) before SQLite dlopens
    // mod_spatialite with RTLD_GLOBAL and puts the system libjpeg 8 in their place. Binding is
    // lazy and per-symbol, so this walks every path the suite uses: encode, EXIF marker, decode.
    [ModuleInitializer]
    internal static void Init()
    {
        try
        {
            using var image = new MagickImage(MagickColors.Black, 1, 1);
            var exif = new ExifProfile();
            exif.SetValue(ExifTag.Make, "preload");
            image.SetProfile(exif);
            image.Format = MagickFormat.Jpeg;
            var bytes = image.ToByteArray();

            using var decoded = new MagickImage(bytes);
            decoded.GetExifProfile();
            decoded.AutoOrient();
            decoded.Strip();
            decoded.Format = MagickFormat.Jpeg;
            decoded.ToByteArray();
        }
        catch
        {
            // A real encoding failure resurfaces per test, where it reads better than here.
        }
    }
}
#endif
