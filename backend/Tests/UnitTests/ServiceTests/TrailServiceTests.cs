using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using System.Linq.Expressions;
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
            new TrailResponseFactory(cfg.Object));
    }

    private static TrailResponse StubTrailResponse() =>
        TrailResponse.Create(Utilities.Identifiers.Trail4, "Vildmarksleden Årås", 8.5M, 2, true,
            "Info", "Symbol", "SymbolImg", "Desc", "FullDesc", "Tags",
            "user-id", true, "Arås", null, null, null);

    private static UpdateTrailRequest ValidUpdateRequest() => new()
    {
        Name = "Updated Trail",
        TrailLength = 12.0M,
        Classification = 3,
        Accessibility = false,
        Description = "Updated description",
    };

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
        result.Message!.StatusCode.Should().Be(404);
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
        result.Value!.Identifier.Should().Be(Utilities.Identifiers.Trail4);
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
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenExceptionThrown_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(It.IsAny<string>(), It.IsAny<Expression<Func<Trail, TrailResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailResponse>.Error());

        // Act
        var result = await Build(repo).GetTrailByIdentifierWithoutCoordinatesAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message!.StatusCode.Should().Be(500);
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
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrail_WithValidRequest_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.AddTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Trail t, CancellationToken _) => RepositoryResult<Trail>.Success(t));

        // Act
        var result = await Build(repo).AddTrailAsync(ValidRequest(), Utilities.Stubs.FakeFile(), Utilities.Stubs.TwoImages(), "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Name.Should().Be("Test Trail");
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
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrail_WhenUploadThrowsException_ReturnsInternalServerError()
    {
        // Arrange — throw on the very first upload, so uploadedUrls is empty and no cleanup is expected
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
        result.Message!.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task AddTrail_WhenImageUploadThrowsAfterSymbolUploaded_CleansUpSymbol()
    {
        // Arrange — symbol upload succeeds (adds URL), first image upload throws
        var repo = new Mock<ITrailRepository>();
        var webDav = new Mock<IWebDavService>();
        webDav.SetupSequence(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Ok<string?>("symbols/symbol.jpg"))
            .ThrowsAsync(new Exception("disk full"));
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true));

        // Act
        var result = await Build(repo, webDav).AddTrailAsync(ValidRequest(), Utilities.Stubs.FakeFile(), Utilities.Stubs.TwoImages(), "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message!.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync("symbols/symbol.jpg"), Times.Once);
    }

    [Fact]
    public async Task AddTrail_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.AddTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Trail>.Error());

        // Act
        var result = await Build(repo).AddTrailAsync(ValidRequest(), null, null, "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrail_WithSymbolAndImages_SymbolUrlNotStoredAsTrailImage()
    {
        // Arrange
        Trail? capturedTrail = null;
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.AddTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .Callback<Trail, CancellationToken>((t, _) => capturedTrail = t)
            .ReturnsAsync((Trail t, CancellationToken _) => RepositoryResult<Trail>.Success(t));

        var webDav = new Mock<IWebDavService>();
        webDav.SetupSequence(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Ok<string?>("symbols/symbol.jpg"))
            .ReturnsAsync(Result.Ok<string?>("trails/img1.jpg"))
            .ReturnsAsync(Result.Ok<string?>("trails/img2.jpg"));

        // Act
        var result = await Build(repo, webDav).AddTrailAsync(ValidRequest(), Utilities.Stubs.FakeFile(), Utilities.Stubs.TwoImages(), "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        capturedTrail.Should().NotBeNull();
        capturedTrail.TrailSymbolImage.Should().Be("symbols/symbol.jpg");
        capturedTrail.TrailImages.Should().NotBeNull();
        capturedTrail.TrailImages.Should().HaveCount(2);
        capturedTrail.TrailImages.Select(i => i.ImageUrl).Should().NotContain("symbols/symbol.jpg");
    }

    [Fact]
    public async Task AddTrail_WithImages_ResponseImageUrlsHaveBaseUrlPrepended()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.AddTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Trail t, CancellationToken _) => RepositoryResult<Trail>.Success(t));

        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Ok<string?>("trails/img.jpg"));

        // Act
        var result = await Build(repo, webDav).AddTrailAsync(ValidRequest(), null, Utilities.Stubs.TwoImages(), "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.TrailImagesResponse.Should().NotBeNull();
        result.Value.TrailImagesResponse.Should().NotBeEmpty();
        result.Value.TrailImagesResponse.Should().AllSatisfy(img =>
            img.ImageUrl.Should().StartWith("http://stigvidd.se/testing/"));
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
        repo.Setup(r => r.GetPopularTrailOverviewsAsync(It.IsAny<string>(), It.IsAny<double?>(), It.IsAny<double?>(), It.IsAny<CancellationToken>()))
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
        repo.Setup(r => r.GetPopularTrailOverviewsAsync(It.IsAny<string>(), It.IsAny<double?>(), It.IsAny<double?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailOverviewResponse>>.Error());

        // Act
        var result = await Build(repo).GetPopularTrailOverviewsAsync(57.0, 12.0, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message!.StatusCode.Should().Be(500);
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
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllTrailsWithBasicInfo_WhenExceptionThrown_PropagatesException()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetAllTrailsWithBasicInfoAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("database unavailable"));

        // Act & Assert
        await Build(repo)
            .Invoking(s => s.GetAllTrailsWithBasicInfoAsync(CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>();
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
    public async Task GetAllTrailMarkers_WhenExceptionThrown_PropagatesException()
    {
        // Arrange — no try/catch in the service method, so unexpected exceptions bubble up
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetAllTrailMarkersAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("database unavailable"));

        // Act & Assert
        await Build(repo)
            .Invoking(s => s.GetAllTrailMarkersAsync(CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task GetTrailCard_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<Trail, TrailCardProjection>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailCardProjection>.NotFound());

        // Act
        var result = await Build(repo).GetTrailCardByIdentifierAsync("no-trail", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetTrailCard_WhenRepositoryErrors_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<Trail, TrailCardProjection>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailCardProjection>.Error());

        // Act
        var result = await Build(repo).GetTrailCardByIdentifierAsync("any-trail", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetTrailCard_WhenFound_ReturnsCard()
    {
        // Arrange
        var projection = new TrailCardProjection(
            Utilities.Identifiers.Trail4, "Vildmarksleden Årås", 8.5M, 2, true, 4.0M,
            new TrailCardImageProjection("img-aras-1", "trails/img.jpg"));
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(
                Utilities.Identifiers.Trail4,
                It.IsAny<Expression<Func<Trail, TrailCardProjection>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailCardProjection>.Success(projection));

        // Act
        var result = await Build(repo).GetTrailCardByIdentifierAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Utilities.Identifiers.Trail4);
        result.Value.Name.Should().Be("Vildmarksleden Årås");
        result.Value.AverageRating.Should().Be(4.0M);
        result.Value.Image.Should().NotBeNull();
    }

    [Fact]
    public async Task GetTrailCard_WhenFound_ImageUrlHasBaseUrlPrepended()
    {
        // Arrange
        var projection = new TrailCardProjection(
            Utilities.Identifiers.Trail4, "Trail", 5M, 1, false, 3.0M,
            new TrailCardImageProjection("img-1", "trails/img.jpg"));
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<Trail, TrailCardProjection>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailCardProjection>.Success(projection));

        // Act
        var result = await Build(repo).GetTrailCardByIdentifierAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Value.Should().NotBeNull();
        result.Value.Image.Should().NotBeNull();
        result.Value.Image.ImageUrl.Should().Be("http://stigvidd.se/testing/trails/img.jpg");
    }

    [Fact]
    public async Task GetTrailCard_WhenFound_AndTrailHasNoImages_ImageIsNull()
    {
        // Arrange
        var projection = new TrailCardProjection(
            Utilities.Identifiers.Trail4, "Trail", 5M, 1, false, 3.0M, null);
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailByIdentifierAsync(
                It.IsAny<string>(),
                It.IsAny<Expression<Func<Trail, TrailCardProjection>>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailCardProjection>.Success(projection));

        // Act
        var result = await Build(repo).GetTrailCardByIdentifierAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Image.Should().BeNull();
    }

    [Fact]
    public async Task GetCoordinates_WhenError_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetCoordinatesByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.Error());

        // Act
        var result = await Build(repo).GetCoordinatesByTrailIdentifierAsync(Utilities.Identifiers.Trail4, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateTrail_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var updatedTrail = new Trail
        {
            Identifier = Utilities.Identifiers.Trail4,
            Name = "Updated Trail",
            TrailLength = 12.0M,
        };
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.UpdateTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Trail>.Success(updatedTrail));

        // Act
        var result = await Build(repo).UpdateTrailAsync(ValidUpdateRequest(), Utilities.Identifiers.Trail4, "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("Updated Trail");
    }

    [Fact]
    public async Task UpdateTrail_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.UpdateTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Trail>.NotFound());

        // Act
        var result = await Build(repo).UpdateTrailAsync(ValidUpdateRequest(), "no-trail", "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateTrail_WhenError_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.UpdateTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Trail>.Error());

        // Act
        var result = await Build(repo).UpdateTrailAsync(ValidUpdateRequest(), Utilities.Identifiers.Trail4, "user-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrailImages_WhenSuccess_ReturnsImagesWithBaseUrlPrepended()
    {
        // Arrange
        IReadOnlyCollection<TrailImage> savedImages =
        [
            new TrailImage { Identifier = "img-new-1", ImageUrl = "trails/img1.jpg" },
            new TrailImage { Identifier = "img-new-2", ImageUrl = "trails/img2.jpg" },
        ];
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(4));
        repo.Setup(r => r.AddTrailImagesAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<TrailImage>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailImage>>.Success(savedImages));

        // Act
        var result = await Build(repo).AddTrailImagesAsync(Utilities.Identifiers.Trail4, Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Should().HaveCount(2);
        result.Value.Should().AllSatisfy(img => img.ImageUrl.Should().StartWith("http://stigvidd.se/testing/"));
    }

    [Fact]
    public async Task AddTrailImages_WhenTrailNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        // Act
        var result = await Build(repo).AddTrailImagesAsync("no-trail", Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailImages_WhenUploadFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(4));
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<string?>(new Message(500, "Upload failed")));

        // Act
        var result = await Build(repo, webDav).AddTrailImagesAsync(Utilities.Identifiers.Trail4, Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrailImages_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(4));
        repo.Setup(r => r.AddTrailImagesAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<TrailImage>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailImage>>.Error());

        // Act
        var result = await Build(repo).AddTrailImagesAsync(Utilities.Identifiers.Trail4, Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteTrailImage_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.DeleteTrailImageAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).DeleteTrailImageAsync("img-aras-1", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteTrailImage_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.DeleteTrailImageAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        // Act
        var result = await Build(repo).DeleteTrailImageAsync("no-image", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteTrailImage_WhenError_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<ITrailRepository>();
        repo.Setup(r => r.DeleteTrailImageAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        var result = await Build(repo).DeleteTrailImageAsync("img-aras-1", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
