using Core;
using Core.Factories;
using Core.Interfaces;
using Core.Services;
using FluentAssertions;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using System.Text;

namespace ServiceTests;

public class ReviewServiceTests : TestBase
{
    #region Seed identifiers

    // Users
    private const string NaturElskarenIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // User 1
    private const string VandrarVennenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";  // User 2
    private const string KattletenIdentifier = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5a33";       // User 5

    // Trails
    private const string NassehultIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c"; // 2 reviews seeded
    private const string HultaforsIdentifier = "66f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b"; // 0 reviews seeded

    // Reviews
    private const string Review1Identifier = "r1a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c"; // VandrarVennen, on Tiveden, with images
    private const string Review2Identifier = "r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"; // NaturElskaren, on Storsjöleden, no images
    private const string Review5Identifier = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a"; // Kattleten, on Vildmarksleden Årås, no text

    #endregion

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenReviewsExist_ShouldReturnReviews()
    {
        // Arrange
        var reviewService = CreateReviewService();
        int page = 0;
        int limit = 10;

        // Act
        var result = await reviewService.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, page, limit, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Reviews.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenNoReviewsExist_ShouldReturnSuccess()
    {
        // Arrange
        var reviewService = CreateReviewService();
        int page = 0;
        int limit = 10;

        // Act
        var result = await reviewService.GetReviewsByTrailIdentifierAsync(HultaforsIdentifier, page, limit, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddReview_WithValidRequest_ShouldReturnSuccess()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var trailReview = "Great trail!";
        var rating = 4.5M;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, trailReview, rating, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddReview_WithInvalidUserIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var trailReview = "Great trail!";
        var rating = 4.5M;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync("i-am-an-invalid-user-identifier", NassehultIdentifier, trailReview, rating, imageUrls, CancellationToken.None);

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
        var trailReview = "Great trail!";
        var rating = 4.5M;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, "i-am-an-invalid-trail-identifier", trailReview, rating, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task AddReview_WithInvalidRating_ShouldReturnBadRequest()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var trailReview = "Great trail!";
        var rating = 1337M;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, trailReview, rating, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task DeleteReview_ShouldReturnSuccess()
    {
        // Arrange
        var reviewService = CreateReviewService();

        // Act
        var result = await reviewService.DeleteReviewAsync(Review5Identifier, KattletenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteReview_WithInvalid_ReviewIdentifier_ShouldReturnNotFound()
    {
        // Arrange
        var reviewService = CreateReviewService();

        // Act
        var result = await reviewService.DeleteReviewAsync("i-am-an-invalid-identifier", KattletenIdentifier, CancellationToken.None);

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

        // Act
        var result = await reviewService.DeleteReviewAsync(Review5Identifier, "i-am-an-invalid-user-identifier", CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    // ClaudeTests

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WithPagination_ShouldReturnCorrectPage()
    {
        // Arrange
        var reviewService = CreateReviewService();
        int page = 0;
        int limit = 1;

        // Act
        var result = await reviewService.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, page, limit, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Reviews.Should().HaveCount(1);
        result.Value.HasMore.Should().BeTrue();
        result.Value.Total.Should().Be(2);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenLimitExceedsReviewCount_ShouldReturnAllReviews()
    {
        // Arrange
        var reviewService = CreateReviewService();
        int page = 0;
        int limit = 10;

        // Act
        var result = await reviewService.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, page, limit, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Reviews.Should().HaveCount(2);
        result.Value.HasMore.Should().BeFalse();
        result.Value.Total.Should().Be(2);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_OnSecondPage_ShouldReturnRemainingReviews()
    {
        // Arrange
        var reviewService = CreateReviewService();
        int page = 1;
        int limit = 1;

        // Act
        var result = await reviewService.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, page, limit, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Reviews.Should().HaveCount(1);
        result.Value.HasMore.Should().BeFalse();
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_BeyondLastPage_ShouldReturnEmptyList()
    {
        // Arrange
        var reviewService = CreateReviewService();
        int page = 10;
        int limit = 10;

        // Act
        var result = await reviewService.GetReviewsByTrailIdentifierAsync(NassehultIdentifier, page, limit, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Reviews.Should().BeEmpty();
        result.Value.HasMore.Should().BeFalse();
        result.Value.Total.Should().Be(2);
    }

    [Fact]
    public async Task AddReview_WithRatingBelowMinValue_ShouldReturnBadRequest()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var rating = 0.5M;

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, "Test review", rating, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task AddReview_WithRatingAtMinValue_ShouldReturnSuccess()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var rating = 1.0M;

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, "Minimum rating review", rating, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Rating.Should().Be(1.0M);
    }

    [Fact]
    public async Task AddReview_WithRatingAtMaxValue_ShouldReturnSuccess()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var rating = 5.0M;

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, "Maximum rating review", rating, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Rating.Should().Be(5.0M);
    }

    [Fact]
    public async Task AddReview_WithRatingAboveMaxValue_ShouldReturnBadRequest()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var rating = 5.1M;

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, "Test review", rating, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task AddReview_WithNullImages_ShouldReturnSuccess()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var rating = 4.0M;

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, "Review without images", rating, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddReview_WithEmptyImageCollection_ShouldReturnSuccess()
    {
        // Arrange
        var reviewService = CreateReviewService();
        var rating = 4.0M;
        var emptyImages = new FormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, "Review with empty images", rating, emptyImages, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddReview_WithNullTrailReview_ShouldReturnSuccess()
    {
        // Arrange
        var reviewService = CreateReviewService();
        string? trailReview = null;
        var rating = 4.0M;

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, trailReview, rating, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.TrailReview.Should().BeNullOrEmpty();
    }

    [Fact]
    public async Task AddReview_WhenUploadFails_ShouldReturnFailure()
    {
        // Arrange
        var reviewService = CreateReviewService(uploadShouldReturnFailure: true);
        var rating = 4.0M;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, "Review with failed upload", rating, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WhenUploadThrowsException_ShouldReturnFailure()
    {
        // Arrange
        var reviewService = CreateReviewService(uploadShouldThrowException: true);
        var rating = 4.0M;
        var imageUrls = GetFormFileCollection();

        // Act
        var result = await reviewService.AddReviewAsync(NaturElskarenIdentifier, NassehultIdentifier, "Review with exception during upload", rating, imageUrls, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteReview_WithImages_ShouldSucceed()
    {
        // Arrange
        var reviewService = CreateReviewService();

        // Act
        var result = await reviewService.DeleteReviewAsync(Review1Identifier, VandrarVennenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteReview_WhenWebDavDeleteFails_ShouldReturnFailure()
    {
        // Arrange
        var reviewService = CreateReviewService(deleteShouldReturnFailure: true);

        // Act
        var result = await reviewService.DeleteReviewAsync(Review1Identifier, VandrarVennenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteReview_WhenWebDavDeleteThrowsException_ShouldLogWarningAndContinue()
    {
        // Arrange
        var reviewService = CreateReviewService(deleteShouldThrowException: true);

        // Act
        var result = await reviewService.DeleteReviewAsync(Review1Identifier, VandrarVennenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteReview_WithoutImages_ShouldSucceed()
    {
        // Arrange
        var reviewService = CreateReviewService();

        // Act
        var result = await reviewService.DeleteReviewAsync(Review2Identifier, NaturElskarenIdentifier, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    private ReviewService CreateReviewService(
        bool uploadShouldThrowException = false,
        bool uploadShouldReturnFailure = false,
        bool deleteShouldThrowException = false,
        bool deleteShouldReturnFailure = false)
    {
        var dbContext = CreateContextAndSqliteDb();
        var mockContextFactory = new Mock<IDbContextFactory<StigViddDbContext>>();
        mockContextFactory.Setup(factory => factory.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(dbContext);
        var mockLogger = new Mock<ILogger<ReviewService>>();
        var mockWebDavService = new Mock<IWebDavService>();

        // Setup för UploadFileAsync
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
                .ReturnsAsync(Result.Ok<string?>("reviews/test-image.jpg"));
        }

        // Setup för DeleteFileAsync
        if (deleteShouldThrowException)
        {
            mockWebDavService
                .Setup(x => x.DeleteFileAsync(It.IsAny<string>()))
                .ThrowsAsync(new Exception("DeleteFileAsync: Error deleting reviews/guid.jpeg"));
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

        var reviewResponseFactory = new ReviewResponseFactory(mockConfiguration.Object);

        var reviewService = new ReviewService(
            mockContextFactory.Object,
            mockWebDavService.Object,
            reviewResponseFactory,
            mockLogger.Object,
            mockConfiguration.Object
        );

        return reviewService;
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
