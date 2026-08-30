// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Core.Services;
using AwesomeAssertions;
using ImageMagick;

namespace UnitTests.ServiceTests;

public class ImageProcessingServiceTests
{
    private static MemoryStream MakeImage(uint width, uint height, MagickFormat format = MagickFormat.Png)
    {
        using var image = new MagickImage(new MagickColor("#3366cc"), width, height);
        image.Format = format;
        var ms = new MemoryStream();
        image.Write(ms);
        ms.Position = 0;
        return ms;
    }

    [Fact]
    public void Process_WhenSourceCarriesExifGps_StripsItFromTheOutput()
    {
        var service = new ImageProcessingService();

        using var source = new MemoryStream();
        using (var image = new MagickImage(new MagickColor("#3366cc"), 400, 300))
        {
            var exif = new ExifProfile();
            exif.SetValue(ExifTag.Make, "TestPhone");
            exif.SetValue(ExifTag.GPSLatitudeRef, "N");
            exif.SetValue(ExifTag.GPSLatitude, [new Rational(57), new Rational(37), new Rational(0)]);
            image.SetProfile(exif);
            image.Format = MagickFormat.Jpeg;
            image.Write(source);
        }
        source.Position = 0;

        // Guard: without EXIF in the source the assertion below passes for free.
        using (var unprocessed = new MagickImage(source))
            unprocessed.GetExifProfile().Should().NotBeNull();
        source.Position = 0;

        using var result = service.Process(source, ImageProcessingOptions.StripMetadataOnly);

        using var processed = new MagickImage(result.Stream);
        processed.GetExifProfile().Should().BeNull();
    }

    [Fact]
    public void Process_WhenLargerThanMax_DownscalesKeepingAspectRatio()
    {
        var service = new ImageProcessingService();
        using var source = MakeImage(2000, 1000);

        using var result = service.Process(source, new ImageProcessingOptions { MaxWidth = 1000, MaxHeight = 1000 });

        result.Width.Should().Be(1000);
        result.Height.Should().Be(500);
    }

    [Fact]
    public void Process_WhenSmallerThanMax_DoesNotUpscale()
    {
        var service = new ImageProcessingService();
        using var source = MakeImage(400, 300);

        using var result = service.Process(source, new ImageProcessingOptions { MaxWidth = 4000, MaxHeight = 4000 });

        result.Width.Should().Be(400);
        result.Height.Should().Be(300);
    }

    [Fact]
    public void Process_WhenWebPFormatRequested_ReturnsWebPExtensionAndContentType()
    {
        var service = new ImageProcessingService();
        using var source = MakeImage(800, 600);

        using var result = service.Process(source, new ImageProcessingOptions { Format = ImageOutputFormat.WebP });

        result.Extension.Should().Be("webp");
        result.ContentType.Should().Be("image/webp");
    }

    [Fact]
    public void Process_WhenCropApplied_ProducesCroppedDimensions()
    {
        var service = new ImageProcessingService();
        using var source = MakeImage(1000, 1000);

        using var result = service.Process(source, new ImageProcessingOptions
        {
            Crop = new CropRectangle(100, 100, 400, 200)
        });

        result.Width.Should().Be(400);
        result.Height.Should().Be(200);
    }

    [Fact]
    public void Process_LowerQuality_ProducesSmallerFileThanHighQuality()
    {
        var service = new ImageProcessingService();

        // A noisy image so quality actually affects size.
        using var noisy = new MagickImage(new MagickColor("#3366cc"), 800, 800);
        noisy.AddNoise(NoiseType.Gaussian);
        noisy.Format = MagickFormat.Jpeg;
        using var baseStream = new MemoryStream();
        noisy.Write(baseStream);

        using var highSource = new MemoryStream(baseStream.ToArray());
        using var lowSource = new MemoryStream(baseStream.ToArray());

        using var high = service.Process(highSource, new ImageProcessingOptions { Format = ImageOutputFormat.Jpeg, Quality = 95 });
        using var low = service.Process(lowSource, new ImageProcessingOptions { Format = ImageOutputFormat.Jpeg, Quality = 20 });

        low.SizeBytes.Should().BeLessThan(high.SizeBytes);
    }
}
