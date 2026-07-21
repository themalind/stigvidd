using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;

namespace UnitTests.ServiceTests;

public class MediaUploadServiceTests
{
    private static MediaUploadService Build(
        Mock<IImageProcessingService> processing,
        Mock<IWebDavService> webDav) =>
        new(processing.Object, webDav.Object, new Mock<ILogger<MediaUploadService>>().Object);

    private static ProcessedImage MakeProcessed() => new()
    {
        Stream = new MemoryStream([0x01, 0x02]),
        Extension = "webp",
        ContentType = "image/webp",
        Width = 800,
        Height = 600,
        SizeBytes = 4321
    };

    [Fact]
    public async Task ProcessAndUploadAsync_WhenValid_ReturnsUploadedMediaWithProcessedDimensions()
    {
        // Arrange
        var processing = new Mock<IImageProcessingService>();
        processing.Setup(p => p.Process(It.IsAny<Stream>(), It.IsAny<ImageProcessingOptions>()))
            .Returns(MakeProcessed());

        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), "facilities", It.IsAny<string>()))
            .ReturnsAsync(Result.Ok<string?>("facilities/stored.webp"));

        // Act
        var result = await Build(processing, webDav)
            .ProcessAndUploadAsync(new MemoryStream(), "facilities", new ImageProcessingOptions());

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Path.Should().Be("facilities/stored.webp");
        result.Value.Width.Should().Be(800);
        result.Value.Height.Should().Be(600);
        result.Value.SizeBytes.Should().Be(4321);
    }

    [Fact]
    public async Task ProcessAndUploadAsync_UploadsProcessedStreamWithProcessedExtension()
    {
        // Arrange
        var processing = new Mock<IImageProcessingService>();
        processing.Setup(p => p.Process(It.IsAny<Stream>(), It.IsAny<ImageProcessingOptions>()))
            .Returns(MakeProcessed());

        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Ok<string?>("facilities/stored.webp"));

        // Act
        await Build(processing, webDav)
            .ProcessAndUploadAsync(new MemoryStream(), "facilities", new ImageProcessingOptions());

        // Assert — the extension handed to WebDAV is the processed image's, not the source's.
        webDav.Verify(w => w.UploadFileAsync(It.IsAny<Stream>(), "facilities", "webp"), Times.Once);
    }

    [Fact]
    public async Task ProcessAndUploadAsync_WhenUploadFails_PropagatesUploadMessage()
    {
        // Arrange
        var processing = new Mock<IImageProcessingService>();
        processing.Setup(p => p.Process(It.IsAny<Stream>(), It.IsAny<ImageProcessingOptions>()))
            .Returns(MakeProcessed());

        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<string?>(new Message(507, "storage full")));

        // Act
        var result = await Build(processing, webDav)
            .ProcessAndUploadAsync(new MemoryStream(), "facilities", new ImageProcessingOptions());

        // Assert — the upstream WebDAV message is surfaced, not a generic one.
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(507);
    }

    [Fact]
    public async Task ProcessAndUploadAsync_WhenUploadReturnsNullPath_Returns500()
    {
        // Arrange
        var processing = new Mock<IImageProcessingService>();
        processing.Setup(p => p.Process(It.IsAny<Stream>(), It.IsAny<ImageProcessingOptions>()))
            .Returns(MakeProcessed());

        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Ok<string?>(null));

        // Act
        var result = await Build(processing, webDav)
            .ProcessAndUploadAsync(new MemoryStream(), "facilities", new ImageProcessingOptions());

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task ProcessAndUploadAsync_WhenProcessingThrows_Returns500()
    {
        // Arrange
        var processing = new Mock<IImageProcessingService>();
        processing.Setup(p => p.Process(It.IsAny<Stream>(), It.IsAny<ImageProcessingOptions>()))
            .Throws(new Exception("corrupt image"));

        var webDav = new Mock<IWebDavService>();

        // Act
        var result = await Build(processing, webDav)
            .ProcessAndUploadAsync(new MemoryStream(), "facilities", new ImageProcessingOptions());

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        // Nothing should be uploaded when processing blows up first.
        webDav.Verify(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }
}
