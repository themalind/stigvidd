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
using WebDataContracts.ResponseModels.Review;

namespace UnitTests.ServiceTests;

public class ReviewServiceTests
{
    private ReviewService Build(
        Mock<IReviewResponseRepository>? reviewRepo = null,
        Mock<IWebDavService>? webDav = null,
        Mock<IUserService>? userSvc = null,
        Mock<ITrailService>? trailSvc = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        return new ReviewService(
            (reviewRepo ?? new Mock<IReviewResponseRepository>()).Object,
            (webDav ?? Utilities.MockFactory.WebDavService()).Object,
            (userSvc ?? Utilities.MockFactory.UserServiceFoundById()).Object,
            (trailSvc ?? Utilities.MockFactory.TrailServiceFound()).Object,
            new ReviewResponseFactory(cfg.Object),
            new Mock<ILogger<ReviewService>>().Object);
    }

    private static PagedReviewResponse StubPage(int count = 2) => new()
    {
        Reviews = Enumerable.Range(0, count)
            .Select(i => ReviewResponse.Create($"r{i}", "text", 4M, "Nick", DateTime.UtcNow, Utilities.Identifiers.Trail7, Utilities.Identifiers.User, null))
            .ToList(),
        Page = 0,
        HasMore = false,
        Total = count
    };

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenSuccess_ReturnsReviews()
    {
        // Arrange
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewsByTrailIdentifierAsync(Utilities.Identifiers.Trail7, 0, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedReviewResponse>.Success(StubPage(2)));

        // Act
        var result = await Build(repo).GetReviewsByTrailIdentifierAsync(Utilities.Identifiers.Trail7, 0, 10, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Reviews.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenRepositoryFails_Returns500()
    {
        // Arrange
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewsByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedReviewResponse>.Error());

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
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review()));

        // Act
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "Great!", 4.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddReview_WithRatingBelowMin_Returns400()
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
    public async Task AddReview_WithRatingAboveMax_Returns400()
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
        var repo = new Mock<IReviewResponseRepository>();
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
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review()));

        // Act
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 5.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WhenUserNotFound_Returns404()
    {
        // Arrange
        var service = Build(userSvc: Utilities.MockFactory.UserServiceNotFoundById());

        // Act
        var result = await service.AddReviewAsync("invalid", Utilities.Identifiers.Trail7, "text", 4.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddReview_WhenTrailNotFound_Returns404()
    {
        // Arrange
        var service = Build(trailSvc: Utilities.MockFactory.TrailServiceNotFound());

        // Act
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, "invalid", "text", 4.0M, null, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddReview_WhenUploadFails_Returns500()
    {
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<string?>(new Message(500, "Upload failed")));

        // Act
        var result = await Build(webDav: webDav).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WhenUploadThrowsException_Returns500()
    {
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ThrowsAsync(new Exception("network error"));

        // Act
        var result = await Build(webDav: webDav).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WithNullImages_ReturnsSuccess()
    {
        // Arrange
        var repo = new Mock<IReviewResponseRepository>();
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
        var repo = new Mock<IReviewResponseRepository>();
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
        var repo = new Mock<IReviewResponseRepository>();
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
        var repo = new Mock<IReviewResponseRepository>();
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
    public async Task DeleteReview_WhenNotFound_Returns404()
    {
        // Arrange
        var repo = new Mock<IReviewResponseRepository>();
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
    public async Task DeleteReview_WhenWebDavDeleteFails_Returns500()
    {
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<bool>(new Message(500, "Delete failed")));
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review(withImages: true)));

        // Act
        var result = await Build(repo, webDav).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteReview_WhenWebDavDeleteThrowsException_ReturnsSuccess()
    {
        // Exceptions during image cleanup are swallowed — the review is still deleted
        // Arrange
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("network error"));
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review(withImages: true)));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo, webDav).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, CancellationToken.None);

        // Assert
        result.Success.Should().BeTrue();
    }
}
