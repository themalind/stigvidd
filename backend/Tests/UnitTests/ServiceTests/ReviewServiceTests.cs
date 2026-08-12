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
using WebDataContracts.ResponseModels.Review;

namespace UnitTests.ServiceTests;

public class ReviewServiceTests
{
    private ReviewService Build(
        Mock<IReviewRepository>? reviewRepo = null,
        Mock<IWebDavService>? webDav = null,
        Mock<IUserRepository>? userRepo = null,
        Mock<ITrailService>? trailService = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new ReviewService(
            (reviewRepo ?? new Mock<IReviewRepository>()).Object,
            (webDav ?? Utilities.MockFactory.WebDavService()).Object,
            (userRepo ?? Utilities.MockFactory.UserRepositoryFoundById()).Object,
            (trailService ?? Utilities.MockFactory.TrailServiceFound()).Object,
            new ReviewResponseFactory(cfg.Object),
            new Mock<ILogger<ReviewService>>().Object);
    }

    private static PagedResult<ReviewResponse> StubPage(int count = 2) =>
        new(Enumerable.Range(0, count)
                .Select(i => ReviewResponse.Create($"r{i}", "text", 4M, "Nick", DateTime.UtcNow, Utilities.Identifiers.Trail7, Utilities.Identifiers.User, null))
                .ToList(),
            0, false, count);

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenSuccess_ReturnsReviews()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewsByTrailIdentifierAsync(Utilities.Identifiers.Trail7, 0, 10, It.IsAny<Expression<Func<Review, ReviewResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<ReviewResponse>>.Success(StubPage(2)));

        // Act
        var result = await Build(repo).GetReviewsByTrailIdentifierAsync(Utilities.Identifiers.Trail7, 0, 10, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Reviews.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenRepositoryFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewsByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<Expression<Func<Review, ReviewResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<ReviewResponse>>.Error());

        // Act
        var result = await Build(repo).GetReviewsByTrailIdentifierAsync(Utilities.Identifiers.Trail7, 0, 10, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WithValidRating_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review()));

        // Act
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "Great!", 4.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddReview_WithRatingBelowMin_ReturnsBadRequest()
    {
        // Arrange
        var service = Build();

        // Act
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 0.5M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task AddReview_WithRatingAboveMax_ReturnsBadRequest()
    {
        // Arrange
        var service = Build();

        // Act
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 5.1M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task AddReview_WithRatingAtMinBoundary_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review()));

        // Act
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 1.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WithRatingAtMaxBoundary_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review()));

        // Act
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 5.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var service = Build(userRepo: Utilities.MockFactory.UserRepositoryNotFoundById());

        // Act
        var result = await service.AddReviewAsync("invalid", Utilities.Identifiers.Trail7, "text", 4.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddReview_WhenTrailNotFound_ReturnsNotFound()
    {
        // Arrange
        var service = Build(trailService: Utilities.MockFactory.TrailServiceNotFound());

        // Act
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, "invalid", "text", 4.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddReview_WhenUploadFails_ReturnsInternalServerError()
    {
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<string?>(new Message(500, "Upload failed")));

        // Act
        var result = await Build(webDav: webDav).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WhenUploadThrowsException_ReturnsInternalServerError()
    {
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new Exception("network error"));

        // Act
        var result = await Build(webDav: webDav).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WithImages_ResponseImageUrlsHaveBaseUrlPrepended()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review(withImages: true)));

        // Act
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.ReviewImages.Should().NotBeNull();
        result.Value.ReviewImages.Should().NotBeEmpty();
        result.Value.ReviewImages.Should().AllSatisfy(img =>
            img.ImageUrl.Should().StartWith("http://stigvidd.se/testing/"));
    }

    [Fact]
    public async Task AddReview_WithNullImages_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review()));

        // Act
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WithNullReviewText_ReturnsSuccess()
    {
        // Arrange
        var review = Utilities.Stubs.Review();
        review.TrailReview = null;
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(review));

        // Act
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, null, 4.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.TrailReview.Should().BeNullOrEmpty();
    }

    [Fact]
    public async Task DeleteReview_WithoutImages_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review(withImages: false)));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteReview_WithImages_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review(withImages: true)));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteReview_WhenNotFound_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.NotFound());

        // Act
        var result = await Build(repo).DeleteReviewAsync("bad-id", Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteReview_WhenWebDavDeleteFails_ReturnsSuccess()
    {
        // The row is already gone when the files are removed, so a failed file delete is logged
        // and the remaining images are still attempted — the caller is not told the delete failed
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<bool>(new Message(500, "Delete failed")));
        var review = Utilities.Stubs.Review(withImages: true);
        review.ReviewImages = [.. review.ReviewImages!, new ReviewImage { Id = 2, Identifier = "img-2", ImageUrl = "reviews/img2.jpg" }];
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(review));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo, webDav).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, CancellationToken.None);

        // Assert — the first failure did not stop the second file from being attempted
        result.Success.Should().BeTrue();
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Exactly(2));
    }

    [Fact]
    public async Task DeleteReview_WhenWebDavDeleteThrowsException_ReturnsSuccess()
    {
        // Exceptions during image cleanup are swallowed — the review is still deleted
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("network error"));
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review(withImages: true)));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo, webDav).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteUserReviewsOnUserDelete_DeletesTheImageFilesAfterTheRows()
    {
        // Arrange
        var callOrder = new List<string>();
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewImageUrlsByUserIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["reviews/a.jpeg", "reviews/b.jpeg"]));
        repo.Setup(r => r.DeleteReviewsByUserIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success())
            .Callback(() => callOrder.Add("rows"));

        var webDav = Utilities.MockFactory.WebDavService();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true))
            .Callback<string>(url => callOrder.Add(url));

        // Act
        var result = await Build(repo, webDav).DeleteUserReviewsOnUserDeleteAsync(1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        callOrder.Should().Equal("rows", "reviews/a.jpeg", "reviews/b.jpeg");
    }

    [Fact]
    public async Task DeleteUserReviewsOnUserDelete_WhenWebDavThrows_StillSucceeds()
    {
        // Arrange — a failed file delete leaves an orphan, but must not block the account deletion
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewImageUrlsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["reviews/a.jpeg"]));
        repo.Setup(r => r.DeleteReviewsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("webdav down"));

        // Act
        var result = await Build(repo, webDav).DeleteUserReviewsOnUserDeleteAsync(1, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteUserReviewsOnUserDelete_WhenRowDeleteFails_DoesNotTouchWebDav()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewImageUrlsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IEnumerable<string>>.Success(["reviews/a.jpeg"]));
        repo.Setup(r => r.DeleteReviewsByUserIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Error());

        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        var result = await Build(repo, webDav).DeleteUserReviewsOnUserDeleteAsync(1, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }
}
