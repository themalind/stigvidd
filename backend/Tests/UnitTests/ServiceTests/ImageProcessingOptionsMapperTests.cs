using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using WebDataContracts.RequestModels.Media;

namespace UnitTests.ServiceTests;

public class ImageProcessingOptionsMapperTests
{
    [Fact]
    public void ToOptions_WhenRequestNull_ReturnsDefaults()
    {
        // Act
        var options = ((ImageProcessingOptionsRequest?)null).ToOptions();

        // Assert
        options.MaxWidth.Should().BeNull();
        options.MaxHeight.Should().BeNull();
        options.Quality.Should().BeNull();
        options.Format.Should().Be(ImageOutputFormat.Original);
        options.Crop.Should().BeNull();
    }

    [Fact]
    public void ToOptions_PassesThroughDimensionsAndQuality()
    {
        // Arrange
        var request = new ImageProcessingOptionsRequest { MaxWidth = 1024, MaxHeight = 768, Quality = 80 };

        // Act
        var options = request.ToOptions();

        // Assert
        options.MaxWidth.Should().Be(1024);
        options.MaxHeight.Should().Be(768);
        options.Quality.Should().Be(80);
    }

    [Theory]
    [InlineData("jpeg", ImageOutputFormat.Jpeg)]
    [InlineData("jpg", ImageOutputFormat.Jpeg)]
    [InlineData("webp", ImageOutputFormat.WebP)]
    [InlineData("png", ImageOutputFormat.Png)]
    [InlineData("original", ImageOutputFormat.Original)]
    [InlineData("gif", ImageOutputFormat.Original)]
    [InlineData(null, ImageOutputFormat.Original)]
    public void ToOptions_MapsFormatString(string? format, ImageOutputFormat expected)
    {
        // Arrange
        var request = new ImageProcessingOptionsRequest { Format = format };

        // Act
        var options = request.ToOptions();

        // Assert
        options.Format.Should().Be(expected);
    }

    [Fact]
    public void ToOptions_FormatIsCaseAndWhitespaceInsensitive()
    {
        // Arrange
        var request = new ImageProcessingOptionsRequest { Format = "  JPEG " };

        // Act
        var options = request.ToOptions();

        // Assert
        options.Format.Should().Be(ImageOutputFormat.Jpeg);
    }

    [Fact]
    public void ToOptions_WhenCropWidthAndHeightPositive_BuildsCropRectangle()
    {
        // Arrange
        var request = new ImageProcessingOptionsRequest { CropX = 10, CropY = 20, CropWidth = 300, CropHeight = 200 };

        // Act
        var options = request.ToOptions();

        // Assert
        options.Crop.Should().Be(new CropRectangle(10, 20, 300, 200));
    }

    [Fact]
    public void ToOptions_WhenCropOffsetsOmitted_DefaultsToZero()
    {
        // Arrange
        var request = new ImageProcessingOptionsRequest { CropWidth = 300, CropHeight = 200 };

        // Act
        var options = request.ToOptions();

        // Assert
        options.Crop.Should().Be(new CropRectangle(0, 0, 300, 200));
    }

    [Theory]
    [InlineData(null, 200)]
    [InlineData(300, null)]
    [InlineData(0, 200)]
    [InlineData(300, 0)]
    public void ToOptions_WhenCropDimensionsMissingOrZero_LeavesCropNull(int? cropWidth, int? cropHeight)
    {
        // Arrange
        var request = new ImageProcessingOptionsRequest { CropWidth = cropWidth, CropHeight = cropHeight };

        // Act
        var options = request.ToOptions();

        // Assert — a crop needs both a positive width and height, otherwise it is ignored.
        options.Crop.Should().BeNull();
    }
}
