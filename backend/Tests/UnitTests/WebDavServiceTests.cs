using Core.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using WebDav;

namespace UnitTests;

public class WebDavServiceTests
{
    private static WebDavService CreateService(Mock<IWebDavClient> mockClient)
    {
        var mockLogger = new Mock<ILogger<WebDavService>>();
        // Skickar in en factory-lambda som returnerar den per-test-konfigurerade mock-klienten,
        // vilket gör att WebDavService kan skapas utan en riktig HTTP-anslutning.
        return new WebDavService(mockLogger.Object, () => mockClient.Object);
    }

    [Fact]
    public async Task UploadFileAsync_WithSubDirectory_ShouldReturnOk_WithCorrectPath()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.PutFile(It.IsAny<string>(), It.IsAny<Stream>()))
            .ReturnsAsync(new WebDavResponse(200));

        var service = CreateService(mockClient);
        var stream = new MemoryStream([0x01, 0x02]);

        // Act
        var result = await service.UploadFileAsync(stream, "reviews");

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().StartWith("reviews/");
        result.Value.Should().EndWith(".jpeg");
    }

    [Fact]
    public async Task UploadFileAsync_WithoutSubDirectory_ShouldReturnOk_WithFileNameOnly()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.PutFile(It.IsAny<string>(), It.IsAny<Stream>()))
            .ReturnsAsync(new WebDavResponse(200));

        var service = CreateService(mockClient);
        var stream = new MemoryStream([0x01, 0x02]);

        // Act
        var result = await service.UploadFileAsync(stream, null);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotContain("/");
        result.Value.Should().EndWith(".jpeg");
    }

    [Fact]
    public async Task UploadFileAsync_WhenClientReturnsUnsuccessful_ShouldReturnFail()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.PutFile(It.IsAny<string>(), It.IsAny<Stream>()))
            .ReturnsAsync(new WebDavResponse(500));

        var service = CreateService(mockClient);
        var stream = new MemoryStream([0x01, 0x02]);

        // Act
        var result = await service.UploadFileAsync(stream, "reviews");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UploadFileAsync_WhenClientThrowsException_ShouldThrow()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.PutFile(It.IsAny<string>(), It.IsAny<Stream>()))
            .ThrowsAsync(new HttpRequestException("Connection refused"));

        var service = CreateService(mockClient);
        var stream = new MemoryStream([0x01, 0x02]);

        // Act
        var act = async () => await service.UploadFileAsync(stream, "reviews");

        // Assert
        await act.Should().ThrowAsync<Exception>().WithMessage("Error uploading file");
    }

    [Fact]
    public async Task DeleteFileAsync_WhenSuccessful_ShouldReturnOk()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.Delete(It.IsAny<string>()))
            .ReturnsAsync(new WebDavResponse(200));

        var service = CreateService(mockClient);

        // Act
        var result = await service.DeleteFileAsync("reviews/test.jpeg");

        // Assert
        result.Success.Should().BeTrue();
     }

    [Fact]
    public async Task DeleteFileAsync_WhenClientReturnsUnsuccessful_ShouldReturnFail()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.Delete(It.IsAny<string>()))
            .ReturnsAsync(new WebDavResponse(404));

        var service = CreateService(mockClient);

        // Act
        var result = await service.DeleteFileAsync("reviews/nonexistent.jpeg");

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteFileAsync_WhenClientThrowsException_ShouldThrow()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.Delete(It.IsAny<string>()))
            .ThrowsAsync(new HttpRequestException("Connection refused"));

        var service = CreateService(mockClient);

        // Act
        var act = async () => await service.DeleteFileAsync("reviews/test.jpeg");

        // Assert
        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task EnsureDirectoryExistsAsync_WhenDirectoryAlreadyExists_ShouldNotThrow()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.Mkcol(It.IsAny<string>()))
            .ReturnsAsync(new WebDavResponse(405));

        var service = CreateService(mockClient);

        // Act
        var act = async () => await service.EnsureDirectoryExistsAsync("reviews");

        // Assert
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task EnsureDirectoryExistsAsync_WhenClientReturnsOtherFailure_ShouldThrow()
    {
        // Arrange
        var mockClient = new Mock<IWebDavClient>();
        mockClient
            .Setup(c => c.Mkcol(It.IsAny<string>()))
            .ReturnsAsync(new WebDavResponse(500));

        var service = CreateService(mockClient);

        // Act
        var act = async () => await service.EnsureDirectoryExistsAsync("reviews");

        // Assert
        await act.Should().ThrowAsync<Exception>().WithMessage("*500*");
    }
}
