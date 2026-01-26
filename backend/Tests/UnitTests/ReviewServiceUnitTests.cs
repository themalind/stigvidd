using Core.Factories;
using Core.Interfaces;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text;

namespace UnitTests;

public class ReviewServiceUnitTests
{
    [Fact]
    public async Task GetReviewsByTrailIdentifierAsync_ShouldReturnReviews_WhenReviewsExist()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässehult trail

        // Act
        var result = await reviewService.GetReviewsByTrailIdentifierAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifierAsync_ShouldReturnNotFound_WhenNoReviewsExist()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var trailIdentifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b";

        // Act
        var result = await reviewService.GetReviewsByTrailIdentifierAsync(trailIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddReview_ShouldReturnOk()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // NaturElskaren
        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässehult trail
        var trailReview = "Great trail!";
        var grade = 4.5f;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(userIdentifier, trailIdentifier, trailReview, grade, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddReview_WithInvalidUserIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var userIdentifier = "i-am-an-invalid-user-identifier";
        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässehult trail
        var trailReview = "Great trail!";
        var grade = 4.5f;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(userIdentifier, trailIdentifier, trailReview, grade, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Value.Should().BeNull();
    }


    [Fact]
    public async Task AddReview_WithInvalidTrailIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // NaturElskaren
        var trailIdentifier = "i-am-an-invalid-trail-identifier";
        var trailReview = "Great trail!";
        var grade = 4.5f;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(userIdentifier, trailIdentifier, trailReview, grade, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task AddReview_WithInvalidGrade_ShouldReturnBadRequest()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var userIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // NaturElskaren
        var trailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // Nässehult trail
        var trailReview = "Great trail!";
        var grade = 1337f;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(userIdentifier, trailIdentifier, trailReview, grade, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task DeleteReview_ShouldReturnOk()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33";
        var reviewIdentifier = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";
        // Act
        var result = await reviewService.DeleteReviewAsync(reviewIdentifier, userIdentifier, CancellationToken.None); // Review by TrailBlazer

        // Assert
        result.Success.Should().BeTrue();
    }


    [Fact]
    public async Task DeleteReview_WithInvalid_ReviewIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var userIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33";
        var reviewIdentifier = "i-am-an-invalid-identifier";
        // Act
        var result = await reviewService.DeleteReviewAsync(reviewIdentifier, userIdentifier, CancellationToken.None); // Review by TrailBlazer

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }


    [Fact]
    public async Task DeleteReview_WithInvalid_UserIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var userIdentifier = "i-am-an-invalid-user-identifier";
        var reviewIdentifier = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";
        // Act
        var result = await reviewService.DeleteReviewAsync(reviewIdentifier, userIdentifier, CancellationToken.None); // Review by TrailBlazer

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    private ReviewService CreateReviewService()
    {
        var dbContext = CreateContextAndSqliteDb();
        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory.Setup(factory => factory.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(dbContext);

        var mockLogger = new Mock<ILogger<ReviewService>>();

        var mockWebDavService = new Mock<IWebDavService>();
        // Mock the UploadFileAsync method to return a fake URL
        mockWebDavService
            .Setup(x => x.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync("https://stigvidd.se/files/reviews/test-image.jpg");
        // Mock the DeleteFileAsync method to return true
        mockWebDavService
            .Setup(x => x.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(true);

        var mockConfiguration = new Mock<IConfiguration>();
        mockConfiguration.Setup(config => config["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        var reviewResponseFactory = new ReviewResponseFactory(mockConfiguration.Object);

        var reviewService = new ReviewService(
            mockContextFactory.Object,
            mockWebDavService.Object,
            reviewResponseFactory,
            mockLogger.Object,
            mockConfiguration.Object);

        return reviewService;
    }

    private StigViddDbContext CreateContextAndSqliteDb()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var options = new DbContextOptionsBuilder<StigViddDbContext>()
            .UseSqlite(connection)
            .Options;

        var dbContext = new StigViddDbContext(options);
        dbContext.Database.EnsureCreated();

        Utilities.InitializeDbForTests(dbContext);
        return dbContext;
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
