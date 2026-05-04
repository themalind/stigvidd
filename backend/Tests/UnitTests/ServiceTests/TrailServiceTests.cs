using System.Linq.Expressions;
using Core;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace UnitTests.ServiceTests;

public class TrailServiceTests
{
    private TrailService Build(
        Mock<ITrailRepository>? trailRepo = null,
        Mock<IWebDavService>? webDav = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new TrailService(
            (trailRepo ?? new Mock<ITrailRepository>()).Object,
            (webDav ?? Utilities.MockFactory.WebDavService()).Object,
            new Mock<ILogger<TrailService>>().Object,
            new TrailResponseFactory(cfg.Object),
            cfg.Object);
    }

    private static TrailResponse StubTrailResponse() =>
        TrailResponse.Create(Utilities.Identifiers.Trail4, "Vildmarksleden Årås", 8.5M, 2, true,
            "Info", "Symbol", "SymbolImg", "Desc", "FullDesc", "Tags",
            "user-id", true, "Arås", null, null, null);

    private static CreateTrailRequest ValidRequest() => new()
    {
        Name = "Test Trail",
        TrailLength = 10.5M,
        Classification = 2,
        Accessibility = true,
        Description = "A test trail",
        FullDescription = "Full description",
        Coordinates = "[{\"latitude\":57.62,\"longitude\":12.80}]",
        Tags = "[\"skog\"]",
        City = "Test City"
    };

    [Fact]
    public async Task GetTrailIdByIdentifier_WhenFound_ReturnsId()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailIdByIdentifierAsync(Utilities.Identifiers.Trail4, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(4));

        // Act
        var result = await Build(repo).GetTrailIdByIdentifierAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().Be(4);
    }

    [Fact]
    public async Task GetTrailIdByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        // Act
        var result = await Build(repo).GetTrailIdByIdentifierAsync("no-trail", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenFound_ReturnsTrail()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(Utilities.Identifiers.Trail4, It.IsAny<Expression<Func<Trail, TrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailResponse>.Success(StubTrailResponse()));

        // Act
        var result = await Build(repo).GetTrailByIdentifierWithoutCoordinatesAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Utilities.Identifiers.Trail4);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<Trail, TrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailResponse>.NotFound());

        // Act
        var result = await Build(repo).GetTrailByIdentifierWithoutCoordinatesAsync("no-trail", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenExceptionThrown_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<Trail, TrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await Build(repo).GetTrailByIdentifierWithoutCoordinatesAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetCoordinates_WhenFound_ReturnsCoordinates()
    {
        // Arrange
        var json = "[{\"latitude\":57.62,\"longitude\":12.80}]";
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetCoordinatesByTrailIdentifierAsync(Utilities.Identifiers.Trail4, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.Success(json));

        // Act
        var result = await Build(repo).GetCoordinatesByTrailIdentifierAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetCoordinates_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetCoordinatesByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.NotFound());

        // Act
        var result = await Build(repo).GetCoordinatesByTrailIdentifierAsync("no-trail", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrail_WithValidRequest_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.AddTrailAsync(It.IsAny<Infrastructure.Data.Entities.Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Infrastructure.Data.Entities.Trail t, CancellationToken _) => RepositoryResult<Infrastructure.Data.Entities.Trail>.Success(t));

        // Act
        var result = await Build(repo).AddTrailAsync(ValidRequest(), Utilities.Stubs.FakeFile(), Utilities.Stubs.TwoImages(), "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("Test Trail");
    }

    [Fact]
    public async Task AddTrail_WhenUploadFails_ReturnsInternalServerError()
    {
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<string?>(new Message(500, "Upload failed")));

        // Act
        var result = await Build(webDav: webDav).AddTrailAsync(ValidRequest(), Utilities.Stubs.FakeFile(), Utilities.Stubs.TwoImages(), "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrail_WhenUploadThrowsException_ReturnsInternalServerError()
    {
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ThrowsAsync(new Exception("network error"));
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true));

        // Act
        var result = await Build(webDav: webDav).AddTrailAsync(ValidRequest(), Utilities.Stubs.FakeFile(), Utilities.Stubs.TwoImages(), "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrail_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.AddTrailAsync(It.IsAny<Infrastructure.Data.Entities.Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Infrastructure.Data.Entities.Trail>.Error());

        // Act
        var result = await Build(repo).AddTrailAsync(ValidRequest(), null, null, "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetPopularTrailOverviews_WhenSuccess_ReturnsTrails()
    {
        // Arrange
        IReadOnlyCollection<TrailOverviewResponse> overviews =
        [
            TrailOverviewResponse.Create(Utilities.Identifiers.Trail4, "Trail A", 5M, 4.2M, null)
        ];
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetPopularTrailOverviewsAsync(It.IsAny<double?>(), It.IsAny<double?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailOverviewResponse>>.Success(overviews));

        // Act
        var result = await Build(repo).GetPopularTrailOverviewsAsync(null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetPopularTrailOverviews_WhenExceptionThrown_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetPopularTrailOverviewsAsync(It.IsAny<double?>(), It.IsAny<double?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await Build(repo).GetPopularTrailOverviewsAsync(57.0, 12.0, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllTrailsWithBasicInfo_WhenSuccess_ReturnsTrails()
    {
        // Arrange
        IReadOnlyCollection<TrailShortInfoResponse> trails =
        [
            TrailShortInfoResponse.Create(Utilities.Identifiers.Trail4, "Trail A", 5M, true, 2, "Gothenburg")
        ];
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetAllTrailsWithBasicInfoAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>.Success(trails));

        // Act
        var result = await Build(repo).GetAllTrailsWithBasicInfoAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllTrailsWithBasicInfo_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetAllTrailsWithBasicInfoAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>.Error());

        // Act
        var result = await Build(repo).GetAllTrailsWithBasicInfoAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllTrailsWithBasicInfo_WhenExceptionThrown_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetAllTrailsWithBasicInfoAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await Build(repo).GetAllTrailsWithBasicInfoAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllTrailMarkers_WhenSuccess_ReturnsMarkers()
    {
        // Arrange
        IReadOnlyCollection<TrailMarkerResponse> markers =
        [
            new TrailMarkerResponse { Identifier = Utilities.Identifiers.Trail4, Name = "Trail A", StartLatitude = 57.6M, StartLongitude = 12.8M }
        ];
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetAllTrailMarkersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>.Success(markers));

        // Act
        var result = await Build(repo).GetAllTrailMarkersAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllTrailMarkers_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetAllTrailMarkersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>.Error());

        // Act
        var result = await Build(repo).GetAllTrailMarkersAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllTrailMarkers_WhenExceptionThrown_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetAllTrailMarkersAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await Build(repo).GetAllTrailMarkersAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
