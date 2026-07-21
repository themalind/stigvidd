using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace UnitTests.ServiceTests;

public class FacilityServiceTests
{
    private const string FacilityIdentifier = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b";

    private static FacilityService Build(
        Mock<IFacilityRepository>? repo = null,
        Mock<IMediaUploadService>? mediaUpload = null,
        Mock<IWebDavService>? webDav = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new FacilityService(
            (repo ?? new Mock<IFacilityRepository>()).Object,
            new FacilityResponseFactory(),
            (mediaUpload ?? Utilities.MockFactory.MediaUploadService()).Object,
            (webDav ?? Utilities.MockFactory.WebDavService()).Object,
            new Mock<ILogger<FacilityService>>().Object,
            cfg.Object);
    }

    private static Facility MakeFacility() => new()
    {
        Identifier = FacilityIdentifier,
        Name = "Grillplats Tiveden",
        FacilityType = FacilityType.FirePit,
        IsAccessible = true,
        Latitude = 58.9M,
        Longitude = 14.5M
    };

    [Fact]
    public async Task CreateFacilityAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.CreateFacilityAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));

        // Act
        var result = await Build(repo).CreateFacilityAsync("Grillplats Tiveden", 1, true, 14.5M, 58.9M, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be("Grillplats Tiveden");
    }

    [Fact]
    public async Task CreateFacilityAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.CreateFacilityAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).CreateFacilityAsync("Grillplats", 1, true, 14.5M, 58.9M, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Theory]
    [InlineData(1, FacilityType.FirePit)]
    [InlineData(2, FacilityType.Shelter)]
    [InlineData(3, FacilityType.FirePit | FacilityType.Shelter)]
    [InlineData(99, FacilityType.None)]
    public async Task CreateFacilityAsync_MapsFacilityTypeCorrectly(int input, FacilityType expected)
    {
        // Arrange
        Facility? captured = null;
        var facility = MakeFacility();
        facility.FacilityType = expected;

        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.CreateFacilityAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .Callback<Facility, CancellationToken>((f, _) => captured = f)
            .ReturnsAsync(RepositoryResult<Facility>.Success(facility));

        // Act
        await Build(repo).CreateFacilityAsync("Name", input, true, 0M, 0M, CancellationToken.None);

        // Assert
        captured.Should().NotBeNull();
        captured.FacilityType.Should().Be(expected);
    }


    [Fact]
    public async Task GetAllAsync_WhenFacilitiesExist_ReturnsAll()
    {
        // Arrange
        IReadOnlyCollection<Facility> facilities = [MakeFacility()];
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<Facility>>.Success(facilities));

        // Act
        var result = await Build(repo).GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetAllAsync_WhenNoneExist_ReturnsEmptyCollection()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<Facility>>.Success([]));

        // Act
        var result = await Build(repo).GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAllAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<Facility>>.Error());

        // Act
        var result = await Build(repo).GetAllAsync(CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenFound_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));

        // Act
        var result = await Build(repo).GetByIdentifierAsync(FacilityIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(FacilityIdentifier);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.NotFound());

        // Act
        var result = await Build(repo).GetByIdentifierAsync("no-such-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetByIdentifierAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).GetByIdentifierAsync("some-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateFacilityAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));
        repo.Setup(r => r.UpdateAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));

        // Act
        var result = await Build(repo).UpdateFacilityAsync(FacilityIdentifier, "New Name", null, null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateFacilityAsync_WhenNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.NotFound());

        // Act
        var result = await Build(repo).UpdateFacilityAsync("no-such-id", "Name", null, null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task UpdateFacilityAsync_WhenFetchFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).UpdateFacilityAsync(FacilityIdentifier, "Name", null, null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateFacilityAsync_WhenUpdateFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));
        repo.Setup(r => r.UpdateAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).UpdateFacilityAsync(FacilityIdentifier, "Name", null, null, null, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateFacilityAsync_OnlyUpdatesProvidedFields()
    {
        // Arrange
        var original = MakeFacility();
        Facility? captured = null;

        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(original));
        repo.Setup(r => r.UpdateAsync(It.IsAny<Facility>(), It.IsAny<CancellationToken>()))
            .Callback<Facility, CancellationToken>((f, _) => captured = f)
            .ReturnsAsync(RepositoryResult<Facility>.Success(original));

        // Act — only name is provided, all other fields should remain unchanged
        await Build(repo).UpdateFacilityAsync(FacilityIdentifier, "New Name", null, null, null, null, CancellationToken.None);

        // Assert
        captured.Should().NotBeNull();
        captured.Name.Should().Be("New Name");
        captured.FacilityType.Should().Be(original.FacilityType);
        captured.IsAccessible.Should().Be(original.IsAccessible);
        captured.Latitude.Should().Be(original.Latitude);
        captured.Longitude.Should().Be(original.Longitude);
    }

    [Fact]
    public async Task DeleteAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var facility = MakeFacility();
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(facility));
        repo.Setup(r => r.DeleteAsync(facility, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).DeleteAsync(FacilityIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAsync_WhenNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.NotFound());

        // Act
        var result = await Build(repo).DeleteAsync("no-such-id", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteAsync_WhenFetchFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).DeleteAsync(FacilityIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteAsync_WhenDeleteFails_Returns500()
    {
        // Arrange
        var facility = MakeFacility();
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(facility));
        repo.Setup(r => r.DeleteAsync(facility, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        var result = await Build(repo).DeleteAsync(FacilityIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddFacilityImagesAsync_WhenValid_ReturnsImagesWithPresentableUrl()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));
        repo.Setup(r => r.AddFacilityImagesAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<FacilityImage>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((int _, IReadOnlyCollection<FacilityImage> imgs, CancellationToken _) =>
                RepositoryResult<IReadOnlyCollection<FacilityImage>>.Success(imgs));

        // Act
        var result = await Build(repo).AddFacilityImagesAsync(
            FacilityIdentifier, Utilities.Stubs.TwoImages(), new ImageProcessingOptions(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        // The response prefixes the stored path with the configured presentable base url.
        result.Value.Should().OnlyContain(i => i.ImageUrl.StartsWith("http://stigvidd.se/testing/"));
    }

    [Fact]
    public async Task AddFacilityImagesAsync_MapsProcessedDimensionsOntoStoredImages()
    {
        // Arrange
        IReadOnlyCollection<FacilityImage>? captured = null;
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));
        repo.Setup(r => r.AddFacilityImagesAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<FacilityImage>>(), It.IsAny<CancellationToken>()))
            .Callback<int, IReadOnlyCollection<FacilityImage>, CancellationToken>((_, imgs, _) => captured = imgs)
            .ReturnsAsync((int _, IReadOnlyCollection<FacilityImage> imgs, CancellationToken _) =>
                RepositoryResult<IReadOnlyCollection<FacilityImage>>.Success(imgs));

        // Act — the mocked media service returns 800x600, 12345 bytes for every upload.
        await Build(repo).AddFacilityImagesAsync(
            FacilityIdentifier, Utilities.Stubs.TwoImages(), new ImageProcessingOptions(), CancellationToken.None);

        // Assert
        captured.Should().NotBeNull();
        captured.Should().OnlyContain(i => i.Width == 800 && i.Height == 600 && i.SizeBytes == 12345);
        captured.Should().OnlyContain(i => i.ImageUrl == "facilities/test-image.jpg");
    }

    [Fact]
    public async Task AddFacilityImagesAsync_WhenFacilityNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.NotFound());

        // Act
        var result = await Build(repo).AddFacilityImagesAsync(
            "no-such-id", Utilities.Stubs.TwoImages(), new ImageProcessingOptions(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddFacilityImagesAsync_WhenFetchFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Error());

        // Act
        var result = await Build(repo).AddFacilityImagesAsync(
            FacilityIdentifier, Utilities.Stubs.TwoImages(), new ImageProcessingOptions(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddFacilityImagesAsync_WhenUploadFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));

        var media = new Mock<IMediaUploadService>();
        media.Setup(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()))
            .ReturnsAsync(Result.Fail<UploadedMedia>(new Message(500, "upload failed")));

        // Act
        var result = await Build(repo, media).AddFacilityImagesAsync(
            FacilityIdentifier, Utilities.Stubs.TwoImages(), new ImageProcessingOptions(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddFacilityImagesAsync_WhenRepositorySaveFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));
        repo.Setup(r => r.AddFacilityImagesAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<FacilityImage>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<FacilityImage>>.Error());

        // Act
        var result = await Build(repo).AddFacilityImagesAsync(
            FacilityIdentifier, Utilities.Stubs.TwoImages(), new ImageProcessingOptions(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddFacilityImagesAsync_WhenSaveThrows_RollsBackUploadedFilesAndReturns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.GetByIdentifierAsync(FacilityIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Facility>.Success(MakeFacility()));
        repo.Setup(r => r.AddFacilityImagesAsync(It.IsAny<int>(), It.IsAny<IReadOnlyCollection<FacilityImage>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("database unavailable"));

        var webDav = Utilities.MockFactory.WebDavService();

        // Act — two images are uploaded before the save throws.
        var result = await Build(repo, webDav: webDav).AddFacilityImagesAsync(
            FacilityIdentifier, Utilities.Stubs.TwoImages(), new ImageProcessingOptions(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        // Both already-uploaded files must be cleaned up from WebDAV.
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Exactly(2));
    }

    [Fact]
    public async Task DeleteFacilityImageAsync_WhenValid_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.DeleteFacilityImageAsync("img-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).DeleteFacilityImageAsync("img-1", CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteFacilityImageAsync_WhenNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.DeleteFacilityImageAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.NotFound());

        // Act
        var result = await Build(repo).DeleteFacilityImageAsync("no-such-img", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteFacilityImageAsync_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IFacilityRepository>();
        repo.Setup(r => r.DeleteFacilityImageAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        // Act
        var result = await Build(repo).DeleteFacilityImageAsync("img-1", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }
}
