using Core;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text;
using WebDataContracts.RequestModels.Trail;
using WebDataContracts.ResponseModels.Trail;

namespace UnitTests;

public class TrailServiceTests
{
    private const string TrailIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";

    private TrailService Build(
        Mock<ITrailResponseRepository>? trailRepo = null,
        Mock<IWebDavService>? webDav = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new TrailService(
            (trailRepo ?? new Mock<ITrailResponseRepository>()).Object,
            (webDav ?? DefaultWebDav()).Object,
            new Mock<ILogger<TrailService>>().Object,
            new TrailResponseFactory(cfg.Object),
            cfg.Object);
    }

    private static Mock<IWebDavService> DefaultWebDav()
    {
        var m = new Mock<IWebDavService>();
        m.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Ok<string?>("trails/test-image.jpg"));
        m.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true));
        return m;
    }

    private static Trail StubTrail() => new()
    {
        Id = 1,
        Identifier = TrailIdentifier,
        Name = "Vildmarksleden Årås",
        TrailLength = 8.5M,
        Classification = 2,
        Accessibility = true,
        IsVerified = true,
        City = "Arås",
        Coordinates = "[{\"latitude\":57.62,\"longitude\":12.80}]"
    };

    private static TrailResponse StubTrailResponse() =>
        TrailResponse.Create(TrailIdentifier, "Vildmarksleden Årås", 8.5M, 2, true,
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

    private static FormFile FakeFile(string name = "test.jpg")
    {
        var bytes = Encoding.UTF8.GetBytes("fake image content");
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/jpeg"
        };
    }

    private static FormFileCollection TwoImages()
    {
        var col = new FormFileCollection();
        col.Add(FakeFile("img1.jpg"));
        col.Add(FakeFile("img2.jpg"));
        return col;
    }


    [Fact]
    public async Task GetTrailIdByIdentifier_WhenFound_ReturnsId()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetTrailIdByIdentifierAsync(TrailIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(4));

        var result = await Build(repo).GetTrailIdByIdentifierAsync(TrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().Be(4);
    }

    [Fact]
    public async Task GetTrailIdByIdentifier_WhenNotFound_Returns404()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var result = await Build(repo).GetTrailIdByIdentifierAsync("no-trail", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task GetTrailByIdentifier_WhenFound_ReturnsTrail()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetTrailByIdentifierWithoutCoordinatesAsync(TrailIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailResponse>.Success(StubTrailResponse()));

        var result = await Build(repo).GetTrailByIdentifierWithoutCoordinatesAsync(TrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value!.Identifier.Should().Be(TrailIdentifier);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenNotFound_Returns404()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetTrailByIdentifierWithoutCoordinatesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<TrailResponse>.NotFound());

        var result = await Build(repo).GetTrailByIdentifierWithoutCoordinatesAsync("no-trail", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetTrailByIdentifier_WhenExceptionThrown_Returns500()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetTrailByIdentifierWithoutCoordinatesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo).GetTrailByIdentifierWithoutCoordinatesAsync(TrailIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task GetCoordinates_WhenFound_ReturnsCoordinates()
    {
        var json = "[{\"latitude\":57.62,\"longitude\":12.80}]";
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetCoordinatesByTrailIdentifierAsync(TrailIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.Success(json));

        var result = await Build(repo).GetCoordinatesByTrailIdentifierAsync(TrailIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetCoordinates_WhenNotFound_Returns404()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetCoordinatesByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<string>.NotFound());

        var result = await Build(repo).GetCoordinatesByTrailIdentifierAsync("no-trail", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task AddTrail_WithValidRequest_ReturnsSuccess()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.AddTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Trail t, CancellationToken _) => RepositoryResult<Trail>.Success(t));

        var result = await Build(repo).AddTrailAsync(ValidRequest(), FakeFile(), TwoImages(), "user-id", CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Name.Should().Be("Test Trail");
    }

    [Fact]
    public async Task AddTrail_WhenUploadFails_Returns500()
    {
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<string?>(new Message(500, "Upload failed")));

        var result = await Build(webDav: webDav).AddTrailAsync(ValidRequest(), FakeFile(), TwoImages(), "user-id", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrail_WhenUploadThrowsException_Returns500()
    {
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ThrowsAsync(new Exception("network error"));
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true));

        var result = await Build(webDav: webDav).AddTrailAsync(ValidRequest(), FakeFile(), TwoImages(), "user-id", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrail_WhenRepositoryFails_Returns500()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.AddTrailAsync(It.IsAny<Trail>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Trail>.Error());

        var result = await Build(repo).AddTrailAsync(ValidRequest(), null, null, "user-id", CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task GetPopularTrailOverviews_WhenSuccess_ReturnsTrails()
    {
        IReadOnlyCollection<TrailOverviewResponse> overviews =
        [
            TrailOverviewResponse.Create(TrailIdentifier, "Trail A", 5M, 4.2M, null)
        ];
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetPopularTrailOverviewsAsync(It.IsAny<double?>(), It.IsAny<double?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailOverviewResponse>>.Success(overviews));

        var result = await Build(repo).GetPopularTrailOverviewsAsync(null, null, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetPopularTrailOverviews_WhenExceptionThrown_Returns500()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetPopularTrailOverviewsAsync(It.IsAny<double?>(), It.IsAny<double?>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo).GetPopularTrailOverviewsAsync(57.0, 12.0, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task GetAllTrailsWithBasicInfo_WhenSuccess_ReturnsTrails()
    {
        IReadOnlyCollection<TrailShortInfoResponse> trails =
        [
            TrailShortInfoResponse.Create(TrailIdentifier, "Trail A", 5M, true, 2, "Gothenburg")
        ];
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetAllTrailsWithBasicInfoAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>.Success(trails));

        var result = await Build(repo).GetAllTrailsWithBasicInfoAsync(CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllTrailsWithBasicInfo_WhenRepositoryFails_Returns500()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetAllTrailsWithBasicInfoAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailShortInfoResponse>>.Error());

        var result = await Build(repo).GetAllTrailsWithBasicInfoAsync(CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllTrailsWithBasicInfo_WhenExceptionThrown_Returns500()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetAllTrailsWithBasicInfoAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo).GetAllTrailsWithBasicInfoAsync(CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task GetAllTrailMarkers_WhenSuccess_ReturnsMarkers()
    {
        IReadOnlyCollection<TrailMarkerResponse> markers =
        [
            new TrailMarkerResponse { Identifier = TrailIdentifier, Name = "Trail A", StartLatitude = 57.6M, StartLongitude = 12.8M }
        ];
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetAllTrailMarkersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>.Success(markers));

        var result = await Build(repo).GetAllTrailMarkersAsync(CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllTrailMarkers_WhenRepositoryFails_Returns500()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetAllTrailMarkersAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<TrailMarkerResponse>>.Error());

        var result = await Build(repo).GetAllTrailMarkersAsync(CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetAllTrailMarkers_WhenExceptionThrown_Returns500()
    {
        var repo = new Mock<ITrailResponseRepository>();
        repo.Setup(r => r.GetAllTrailMarkersAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        var result = await Build(repo).GetAllTrailMarkersAsync(CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }
}
