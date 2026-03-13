using Core;
using Core.Factories;
using Core.Interfaces;
using Core.Services;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using System.Text;
using WebDataContracts.RequestModels.Trail;

namespace ServiceTests;

public class TrailServiceTests : TestBase
{
    [Fact]
    public async Task GetTrailByIdentifierWithoutCoordinatesAsync_WhenTrailExists_ShouldReturnSuccess_AndTrail()
    {
        // Arrange
        var trailService = CreateTrailService();
        var trailIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f"; // Vildmarksleden Årås

        // Act
        var result = await trailService.GetTrailByIdentifierWithoutCoordinatesAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(trailIdentifier);
    }

    [Fact]
    public async Task GetTrailByIdentifierWithoutCoordinatesAsync_WhenTrailDoesNotExists_ShouldReturnNotFound()
    {
        // Arrange
        var trailService = CreateTrailService();
        var trailIdentifier = "not-a-real-trail";

        // Act
        var result = await trailService.GetTrailByIdentifierWithoutCoordinatesAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Value.Should().BeNull();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetCoordinatesByTrailIdentifierAsync_WhenTrailExists_ShouldReturnSuccess_AndCoordinates()
    {
        // Arrange
        var trailService = CreateTrailService();
        var trailIdentifier = "44d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f"; // Vildmarksleden Årås

        // Act
        var result = await trailService.GetCoordinatesByTrailIdentifierAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetCoordinatesByTrailIdentifierAsync_WhenTrailDoesNotExists_ShouldReturnNotFound()
    {
        // Arrange
        var trailService = CreateTrailService();
        var trailIdentifier = "not-a-real-trail"; // Vildmarksleden Årås

        // Act
        var result = await trailService.GetCoordinatesByTrailIdentifierAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddTrailAsync_WithValidRequest_ShouldReturnSuccess_AndTrail()
    {
        // Arrange
        var trailService = CreateTrailService();

        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // NaturElskaren

        var request = new CreateTrailRequest
        {
            Name = "Test Trail",
            TrailLength = 10.5m,
            Classification = 2,
            TrailSymbol = "skog",
            Accessibility = true,
            AccessibilityInfo = "Wheelchair accessible",
            Description = "A test trail for unit testing.",
            FullDescription = "This is a full description of the test trail.",
            Coordinates = "[{ latitude=57.62141010663575, longitude= 12.805517126805371}]",
            Tags = "[\"skog\", \"sjö\", \"klippor\", \"vildmark\"]",
            IsVerified = false,
            City = "Test City"
        };

        var trailSymbolImage = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("fake image content")), 0, 0, "trailSymbolImage", "trail-symbol.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/jpeg"
        };

        var trailImageUrls = GetFormFileCollection();

        // Act
        var result = await trailService.AddTrailAsync(request, trailSymbolImage, trailImageUrls, userIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Name.Should().Be(request.Name);
        result.Value.TrailImagesResponse.Should().HaveCount(4);
    }

    [Fact]
    public async Task AddTrailAsync_WhenExceptionOccurs_ShouldReturnFailure()
    {
        // Arrange
        var trailService = CreateTrailService(uploadShouldThrowException: true);

        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // NaturElskaren

        var request = new CreateTrailRequest
        {
            Name = "Test Trail",
            TrailLength = 10.5m,
            Classification = 2,
            TrailSymbol = "skog",
            Accessibility = true,
            AccessibilityInfo = "Wheelchair accessible",
            Description = "A test trail for unit testing.",
            FullDescription = "This is a full description of the test trail.",
            Coordinates = "[{ latitude=57.62141010663575, longitude= 12.805517126805371}]",
            Tags = "[\"skog\", \"sjö\", \"klippor\", \"vildmark\"]",
            IsVerified = false,
            City = "Test City"
        };

        var trailSymbolImage = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("fake image content")), 0, 0, "trailSymbolImage", "trail-symbol.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/jpeg"
        };

        var trailImageUrls = GetFormFileCollection();

        // Act
        var result = await trailService.AddTrailAsync(request, trailSymbolImage, trailImageUrls, userIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddTrailAsync_WhenImageUploadFails_ShouldReturnFailure()
    {
        // Arrange
        var trailService = CreateTrailService(uploadShouldReturnFailure: true);

        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // NaturElskaren

        var request = new CreateTrailRequest
        {
            Name = "Test Trail",
            TrailLength = 10.5m,
            Classification = 2,
            TrailSymbol = "skog",
            Accessibility = true,
            AccessibilityInfo = "Wheelchair accessible",
            Description = "A test trail for unit testing.",
            FullDescription = "This is a full description of the test trail.",
            Coordinates = "[{ latitude=57.62141010663575, longitude= 12.805517126805371}]",
            Tags = "[\"skog\", \"sjö\", \"klippor\", \"vildmark\"]",
            IsVerified = false,
            City = "Test City"
        };
        var trailSymbolImage = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("fake image content")), 0, 0, "trailSymbolImage", "trail-symbol.jpg")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/jpeg"
        };
        var trailImageUrls = GetFormFileCollection();

        // Act
        var result = await trailService.AddTrailAsync(request, trailSymbolImage, trailImageUrls, userIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    private TrailService CreateTrailService(
      bool uploadShouldThrowException = false,
      bool uploadShouldReturnFailure = false,
      bool deleteShouldThrowException = false,
      bool deleteShouldReturnFailure = false)
    {
        var dbContext = CreateContextAndSqliteDb();
        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory.Setup(factory => factory.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(dbContext);
        var mockLogger = new Mock<ILogger<TrailService>>();
        var mockWebDavService = new Mock<IWebDavService>();

        // Setup for UploadFileAsync
        if (uploadShouldThrowException)
        {
            mockWebDavService
                .Setup(x => x.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
                .ThrowsAsync(new Exception("Error uploading file"));
        }
        else if (uploadShouldReturnFailure)
        {
            mockWebDavService
                .Setup(x => x.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
                .ReturnsAsync(Result.Fail<string?>(new Message(500, "UploadFileAsync: Could not upload files. 500")));
        }
        else
        {
            mockWebDavService
                .Setup(x => x.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
                .ReturnsAsync(Result.Ok<string?>("trails/test-image.jpg"));
        }

        // Setup for DeleteFileAsync
        if (deleteShouldThrowException)
        {
            mockWebDavService
                .Setup(x => x.DeleteFileAsync(It.IsAny<string>()))
                .ThrowsAsync(new Exception("DeleteFileAsync: Error deleting trails/guid.jpeg"));
        }
        else if (deleteShouldReturnFailure)
        {
            mockWebDavService
                .Setup(x => x.DeleteFileAsync(It.IsAny<string>()))
                .ReturnsAsync(Result.Fail<bool>(new Message(404, "DeleteFileAsync: Could not delete file")));
        }
        else
        {
            mockWebDavService
                .Setup(x => x.DeleteFileAsync(It.IsAny<string>()))
                .ReturnsAsync(Result.Ok(true));
        }

        var mockConfiguration = new Mock<IConfiguration>();
        mockConfiguration.Setup(config => config["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        var trailResponseFactory = new TrailResponseFactory(mockConfiguration.Object);

        var trailService = new TrailService(
            mockContextFactory.Object,
            mockWebDavService.Object,
            mockLogger.Object,
            trailResponseFactory,
            mockConfiguration.Object
        );

        return trailService;
    }

    private FormFileCollection GetFormFileCollection()
    {
        var formFiles = new FormFileCollection();

        for (int i = 0; i < 3; i++)
        {
            var content = Encoding.UTF8.GetBytes($"fake image content {i}");
            var stream = new MemoryStream(content);
            var formFile = new FormFile(stream, 0, content.Length, "files", $"test-image-{i}.jpg")
            {
                Headers = new HeaderDictionary(),
                ContentType = "image/jpeg"
            };
            formFiles.Add(formFile);
        }
        return formFiles;
    }
}
