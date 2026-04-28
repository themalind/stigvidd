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
using WebDataContracts.ResponseModels.Review;

namespace UnitTests;

public class ReviewServiceTests
{
    private const string UserIdentifier = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
    private const string TrailIdentifier = "77a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c";
    private const string ReviewIdentifier = "r5e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a";

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
            (webDav ?? DefaultWebDav()).Object,
            (userSvc ?? UserFound()).Object,
            (trailSvc ?? TrailFound()).Object,
            new ReviewResponseFactory(cfg.Object),
            new Mock<ILogger<ReviewService>>().Object);
    }

    private static Mock<IUserService> UserFound()
    {
        var m = new Mock<IUserService>();
        m.Setup(u => u.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(1));
        return m;
    }

    private static Mock<IUserService> UserNotFound()
    {
        var m = new Mock<IUserService>();
        m.Setup(u => u.GetUserIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<int>(new Message(404, "User not found")));
        return m;
    }

    private static Mock<ITrailService> TrailFound()
    {
        var m = new Mock<ITrailService>();
        m.Setup(t => t.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(1));
        return m;
    }

    private static Mock<ITrailService> TrailNotFound()
    {
        var m = new Mock<ITrailService>();
        m.Setup(t => t.GetTrailIdByIdentifierAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<int>(new Message(404, "Trail not found")));
        return m;
    }

    private static Mock<IWebDavService> DefaultWebDav()
    {
        var m = new Mock<IWebDavService>();
        m.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Ok<string?>("reviews/test-image.jpg"));
        m.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Ok(true));
        return m;
    }

    private static Review StubReview(bool withImages = false) => new()
    {
        Id = 1,
        Identifier = ReviewIdentifier,
        TrailReview = "Great trail",
        Rating = 4.0M,
        User = new User { Id = 1, Identifier = UserIdentifier, NickName = "Nick", Email = "nick@test.com", FirebaseUid = "uid" },
        Trail = new Trail { Id = 1, Identifier = TrailIdentifier, Name = "Trail", TrailLength = 5M },
        CreatedAt = DateTime.UtcNow,
        ReviewImages = withImages
            ? [new ReviewImage { Id = 1, Identifier = "img-1", ImageUrl = "reviews/img.jpg" }]
            : []
    };

    private static PagedReviewResponse StubPage(int count = 2) => new()
    {
        Reviews = Enumerable.Range(0, count)
            .Select(i => ReviewResponse.Create($"r{i}", "text", 4M, "Nick", DateTime.UtcNow, TrailIdentifier, UserIdentifier, null))
            .ToList(),
        Page = 0,
        HasMore = false,
        Total = count
    };

    private static FormFileCollection TwoImages()
    {
        var col = new FormFileCollection();
        for (int i = 0; i < 2; i++)
        {
            var bytes = Encoding.UTF8.GetBytes($"img{i}");
            var file = new FormFile(new MemoryStream(bytes), 0, bytes.Length, "files", $"img{i}.jpg")
            {
                Headers = new HeaderDictionary(),
                ContentType = "image/jpeg"
            };
            col.Add(file);
        }
        return col;
    }


    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenSuccess_ReturnsReviews()
    {
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewsByTrailIdentifierAsync(TrailIdentifier, 0, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedReviewResponse>.Success(StubPage(2)));

        var result = await Build(repo).GetReviewsByTrailIdentifierAsync(TrailIdentifier, 0, 10, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value!.Reviews.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenRepositoryFails_Returns500()
    {
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewsByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedReviewResponse>.Error());

        var result = await Build(repo).GetReviewsByTrailIdentifierAsync(TrailIdentifier, 0, 10, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }


    [Fact]
    public async Task AddReview_WithValidRating_ReturnsSuccess()
    {
        var review = StubReview();
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(review));

        var result = await Build(repo).AddReviewAsync(UserIdentifier, TrailIdentifier, "Great!", 4.0M, null, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task AddReview_WithRatingBelowMin_Returns400()
    {
        var result = await Build().AddReviewAsync(UserIdentifier, TrailIdentifier, "text", 0.5M, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task AddReview_WithRatingAboveMax_Returns400()
    {
        var result = await Build().AddReviewAsync(UserIdentifier, TrailIdentifier, "text", 5.1M, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(400);
    }

    [Fact]
    public async Task AddReview_WithRatingAtMinBoundary_ReturnsSuccess()
    {
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(StubReview()));

        var result = await Build(repo).AddReviewAsync(UserIdentifier, TrailIdentifier, "text", 1.0M, null, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WithRatingAtMaxBoundary_ReturnsSuccess()
    {
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(StubReview()));

        var result = await Build(repo).AddReviewAsync(UserIdentifier, TrailIdentifier, "text", 5.0M, null, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WhenUserNotFound_Returns404()
    {
        var result = await Build(userSvc: UserNotFound()).AddReviewAsync("invalid", TrailIdentifier, "text", 4.0M, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddReview_WhenTrailNotFound_Returns404()
    {
        var result = await Build(trailSvc: TrailNotFound()).AddReviewAsync(UserIdentifier, "invalid", "text", 4.0M, null, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddReview_WhenUploadFails_Returns500()
    {
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<string?>(new Message(500, "Upload failed")));

        var result = await Build(webDav: webDav).AddReviewAsync(UserIdentifier, TrailIdentifier, "text", 4.0M, TwoImages(), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WhenUploadThrowsException_Returns500()
    {
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>()))
            .ThrowsAsync(new Exception("network error"));

        var result = await Build(webDav: webDav).AddReviewAsync(UserIdentifier, TrailIdentifier, "text", 4.0M, TwoImages(), CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WithNullImages_ReturnsSuccess()
    {
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(StubReview()));

        var result = await Build(repo).AddReviewAsync(UserIdentifier, TrailIdentifier, "text", 4.0M, null, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WithNullReviewText_ReturnsSuccess()
    {
        var review = StubReview();
        review.TrailReview = null;
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(review));

        var result = await Build(repo).AddReviewAsync(UserIdentifier, TrailIdentifier, null, 4.0M, null, CancellationToken.None);

        result.Success.Should().BeTrue();
        result.Value!.TrailReview.Should().BeNullOrEmpty();
    }


    [Fact]
    public async Task DeleteReview_WithoutImages_ReturnsSuccess()
    {
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(ReviewIdentifier, UserIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(StubReview(withImages: false)));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo).DeleteReviewAsync(ReviewIdentifier, UserIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteReview_WithImages_ReturnsSuccess()
    {
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(ReviewIdentifier, UserIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(StubReview(withImages: true)));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo).DeleteReviewAsync(ReviewIdentifier, UserIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteReview_WhenNotFound_Returns404()
    {
        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.NotFound());

        var result = await Build(repo).DeleteReviewAsync("bad-id", UserIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task DeleteReview_WhenWebDavDeleteFails_Returns500()
    {
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ReturnsAsync(Result.Fail<bool>(new Message(500, "Delete failed")));

        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(ReviewIdentifier, UserIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(StubReview(withImages: true)));

        var result = await Build(repo, webDav).DeleteReviewAsync(ReviewIdentifier, UserIdentifier, CancellationToken.None);

        result.Success.Should().BeFalse();
        result.Message!.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task DeleteReview_WhenWebDavDeleteThrowsException_ReturnsSuccess()
    {
        // Exceptions during image cleanup are swallowed — the review is still deleted
        var webDav = new Mock<IWebDavService>();
        webDav.Setup(w => w.DeleteFileAsync(It.IsAny<string>()))
            .ThrowsAsync(new Exception("network error"));

        var repo = new Mock<IReviewResponseRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(ReviewIdentifier, UserIdentifier, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(StubReview(withImages: true)));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        var result = await Build(repo, webDav).DeleteReviewAsync(ReviewIdentifier, UserIdentifier, CancellationToken.None);

        result.Success.Should().BeTrue();
    }
}
