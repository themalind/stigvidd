using Core.Interfaces.Repositories;
using Core.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Moq;

namespace UnitTests.ServiceTests;

public class MediaServiceTests
{
    private const string ImageIdentifier = "img-tiveden-1";

    private static MediaService Build(Mock<IMediaRepository>? repo = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new MediaService((repo ?? new Mock<IMediaRepository>()).Object, cfg.Object);
    }

    private static MediaItemProjection MakeProjection() =>
        new(ImageIdentifier, "trails/tiveden.jpg", "Alt", "Caption", 800, 600, 12345, "Trail", "trail-id", "Tiveden");

    [Fact]
    public async Task GetAllMediaAsync_WhenMediaExists_ReturnsWithPresentableUrl()
    {
        // Arrange
        IReadOnlyCollection<MediaItemProjection> media = [MakeProjection()];
        var repo = new Mock<IMediaRepository>();
        repo.Setup(r => r.GetAllMediaAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<MediaItemProjection>>.Success(media));

        // Act
        var result = await Build(repo).GetAllMediaAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
        // The stored path is prefixed with the configured presentable base url.
        result.Value.Should().OnlyContain(m => m.ImageUrl == "http://stigvidd.se/testing/trails/tiveden.jpg");
        result.Value.Should().OnlyContain(m => m.OwnerType == "Trail");
    }

    [Fact]
    public async Task GetAllMediaAsync_WhenNoneExist_ReturnsEmptyCollection()
    {
        // Arrange
        var repo = new Mock<IMediaRepository>();
        repo.Setup(r => r.GetAllMediaAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<MediaItemProjection>>.Success([]));

        // Act
        var result = await Build(repo).GetAllMediaAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAllMediaAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IMediaRepository>();
        repo.Setup(r => r.GetAllMediaAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<MediaItemProjection>>.Error());

        // Act
        var result = await Build(repo).GetAllMediaAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IMediaRepository>();
        repo.Setup(r => r.UpdateImageMetadataAsync(ImageIdentifier, "new alt", "new caption", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).UpdateImageMetadataAsync(ImageIdentifier, "new alt", "new caption", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<IMediaRepository>();
        repo.Setup(r => r.UpdateImageMetadataAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        // Act
        var result = await Build(repo).UpdateImageMetadataAsync("no-such-image", null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateImageMetadataAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IMediaRepository>();
        repo.Setup(r => r.UpdateImageMetadataAsync(It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        var result = await Build(repo).UpdateImageMetadataAsync(ImageIdentifier, "alt", "caption", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
