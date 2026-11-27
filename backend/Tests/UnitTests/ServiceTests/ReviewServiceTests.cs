// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Telemetry;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Interfaces.Repositories.Trails.Models;
using Core.Services;
using AwesomeAssertions;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using System.Linq.Expressions;
using WebDataContracts.RequestModels.Review;
using WebDataContracts.ResponseModels.Review;

namespace UnitTests.ServiceTests;

public class ReviewServiceTests
{
    private ReviewService Build(
        Mock<IReviewRepository>? reviewRepo = null,
        Mock<IWebDavService>? webDav = null,
        Mock<IUserRepository>? userRepo = null,
        Mock<IUserBlockService>? userBlockService = null,
        Mock<ITrailService>? trailService = null,
        Mock<IMediaUploadService>? mediaUpload = null,
        StigviddMetrics? metrics = null)
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");

        reviewRepo ??= new Mock<IReviewRepository>();

        // Every AddReview passes the one-review-per-trail guard; tests that care set their own
        reviewRepo.Setup(r => r.HasUserReviewedTrailAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(false));

        return new ReviewService(
            reviewRepo.Object,
            (webDav ?? Utilities.MockFactory.WebDavService()).Object,
            (mediaUpload ?? Utilities.MockFactory.MediaUploadService()).Object,
            (userRepo ?? Utilities.MockFactory.UserRepositoryFoundById()).Object,
            (userBlockService ?? Utilities.MockFactory.UserBlockServiceHiding()).Object,
            (trailService ?? Utilities.MockFactory.TrailServiceFound()).Object,
            new ReviewResponseFactory(cfg.Object),
            new Mock<ILogger<ReviewService>>().Object,
            metrics ?? new StigviddMetrics());
    }

    private static PagedResult<ReviewResponse> StubPage(int count = 2)
    {
        return new(Enumerable.Range(0, count)
                .Select(i => ReviewResponse.Create($"r{i}", "text", 4M, "Nick", DateTime.UtcNow, null, Utilities.Identifiers.Trail7, Utilities.Identifiers.User, null))
                .ToList(),
            0, false, count);
    }

    [Fact]
    public async Task GetReviewsByTrailIdentifier_WhenSuccess_ReturnsReviews()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewsByTrailIdentifierAsync(Utilities.Identifiers.Trail7, 0, 10, It.IsAny<int[]>(), It.IsAny<Expression<Func<Review, ReviewResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<ReviewResponse>>.Success(StubPage(2)));

        // Act
        var result = await Build(repo).GetReviewsByTrailIdentifierAsync(Utilities.Identifiers.Trail7, 0, 10, null, TestContext.Current.CancellationToken);

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
        repo.Setup(r => r.GetReviewsByTrailIdentifierAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<int[]>(), It.IsAny<Expression<Func<Review, ReviewResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<PagedResult<ReviewResponse>>.Error());

        // Act
        var result = await Build(repo).GetReviewsByTrailIdentifierAsync(Utilities.Identifiers.Trail7, 0, 10, null, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "Great!", 4.0M, null, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
    }

    [Theory]
    [InlineData("  Fin led ", "Fin led")]
    [InlineData("   ", null)]
    public async Task AddReview_StoresTheTextTrimmedLikeAnUpdate(string sent, string? stored)
    {
        // Arrange
        Review? saved = null;
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .Callback<Review, CancellationToken>((review, _) => saved = review)
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review()));

        // Act
        await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, sent, 4.0M, null, TestContext.Current.CancellationToken);

        // Assert
        saved.Should().NotBeNull();
        saved.TrailReview.Should().Be(stored);
    }

    [Fact]
    public async Task AddReview_WithRatingBelowMin_ReturnsBadRequest()
    {
        // Arrange
        var service = Build();

        // Act
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 0.5M, null, TestContext.Current.CancellationToken);

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
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 5.1M, null, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 1.0M, null, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 5.0M, null, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WhenUserNotFound_ReturnsNotFound()
    {
        // Arrange
        var service = Build(userRepo: Utilities.MockFactory.UserRepositoryNotFoundById());

        // Act
        var result = await service.AddReviewAsync("invalid", Utilities.Identifiers.Trail7, "text", 4.0M, null, TestContext.Current.CancellationToken);

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
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, "invalid", "text", 4.0M, null, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task AddReview_WhenUserNotFound_UploadsNothing()
    {
        // Arrange
        var mediaUpload = Utilities.MockFactory.MediaUploadService();
        var service = Build(userRepo: Utilities.MockFactory.UserRepositoryNotFoundById(), mediaUpload: mediaUpload);

        // Act
        var result = await service.AddReviewAsync("invalid", Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        mediaUpload.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()), Times.Never);
    }

    [Fact]
    public async Task AddReview_WhenTrailNotFound_UploadsNothing()
    {
        // Arrange
        var mediaUpload = Utilities.MockFactory.MediaUploadService();
        var service = Build(trailService: Utilities.MockFactory.TrailServiceNotFound(), mediaUpload: mediaUpload);

        // Act
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, "invalid", "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        mediaUpload.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()), Times.Never);
    }

    [Fact]
    public async Task AddReview_UploadsThroughMediaUploadService_SoMetadataIsStripped()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Review r, CancellationToken _) => RepositoryResult<Review>.Success(r));

        var webDav = Utilities.MockFactory.WebDavService();
        var mediaUpload = Utilities.MockFactory.MediaUploadService();

        // Act
        var result = await Build(repo, webDav, mediaUpload: mediaUpload).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        mediaUpload.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), "reviews", It.IsAny<ImageProcessingOptions>()), Times.Exactly(2));
        webDav.Verify(w => w.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task AddReview_WhenRepositoryFails_CleansUpUploadedImages()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Error());

        var webDav = Utilities.MockFactory.WebDavService();
        var mediaUpload = new Mock<IMediaUploadService>();
        mediaUpload.SetupSequence(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()))
            .ReturnsAsync(Result.Ok(new UploadedMedia("reviews/img1.jpg", 800, 600, 1234)))
            .ReturnsAsync(Result.Ok(new UploadedMedia("reviews/img2.jpg", 800, 600, 2345)));

        // Act
        var result = await Build(repo, webDav, mediaUpload: mediaUpload).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync("reviews/img1.jpg"), Times.Once);
        webDav.Verify(w => w.DeleteFileAsync("reviews/img2.jpg"), Times.Once);
    }

    [Fact]
    public async Task AddReview_WhenTheDatabaseRefusesASecondReview_ReturnsConflictAndCleansUpImages()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Conflict());

        var webDav = Utilities.MockFactory.WebDavService();
        var mediaUpload = new Mock<IMediaUploadService>();
        mediaUpload.SetupSequence(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()))
            .ReturnsAsync(Result.Ok(new UploadedMedia("reviews/img1.jpg", 800, 600, 1234)))
            .ReturnsAsync(Result.Ok(new UploadedMedia("reviews/img2.jpg", 800, 600, 2345)));

        // Act
        var result = await Build(repo, webDav, mediaUpload: mediaUpload).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);
        webDav.Verify(w => w.DeleteFileAsync("reviews/img1.jpg"), Times.Once);
        webDav.Verify(w => w.DeleteFileAsync("reviews/img2.jpg"), Times.Once);
    }

    [Fact]
    public async Task AddReview_WhenUploadFails_ReturnsInternalServerError()
    {
        // Arrange
        var mediaUpload = new Mock<IMediaUploadService>();
        mediaUpload.Setup(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()))
            .ReturnsAsync(Result.Fail<UploadedMedia>(new Message(500, "Upload failed")));

        // Act
        var result = await Build(mediaUpload: mediaUpload).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task AddReview_WhenSecondUploadFails_RollsBackTheFirstImage()
    {
        // Arrange
        var webDav = Utilities.MockFactory.WebDavService();
        var mediaUpload = new Mock<IMediaUploadService>();
        mediaUpload.SetupSequence(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()))
            .ReturnsAsync(Result.Ok(new UploadedMedia("reviews/img1.jpg", 800, 600, 1234)))
            .ReturnsAsync(Result.Fail<UploadedMedia>(new Message(500, "Upload failed")));

        // Act
        var result = await Build(webDav: webDav, mediaUpload: mediaUpload).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync("reviews/img1.jpg"), Times.Once);
    }

    [Fact]
    public async Task AddReview_WhenUploadThrowsException_ReturnsInternalServerError()
    {
        // Arrange
        var mediaUpload = new Mock<IMediaUploadService>();
        mediaUpload.Setup(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()))
            .ThrowsAsync(new Exception("network error"));

        // Act
        var result = await Build(mediaUpload: mediaUpload).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, null, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, null, 4.0M, null, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        var result = await Build(repo).DeleteReviewAsync("bad-id", Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        review.ReviewImages.Should().NotBeNull();
        review.ReviewImages = [.. review.ReviewImages, new ReviewImage { Id = 2, Identifier = "img-2", ImageUrl = "reviews/img2.jpg" }];
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(review));
        repo.Setup(r => r.DeleteReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult.Success());

        // Act
        var result = await Build(repo, webDav).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, TestContext.Current.CancellationToken);

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
        var result = await Build(repo, webDav).DeleteReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
    }

    [Fact]
    public async Task AddReview_WhenUserAlreadyReviewedTrail_ReturnsConflictWithoutUploading()
    {
        // Arrange — stubbed after Build, which installs the permissive default
        var repo = new Mock<IReviewRepository>();
        var webDav = Utilities.MockFactory.WebDavService();
        var mediaUpload = new Mock<IMediaUploadService>();
        var service = Build(repo, webDav, mediaUpload: mediaUpload);
        repo.Setup(r => r.HasUserReviewedTrailAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        // Act
        var result = await service.AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(409);

        // Nothing was uploaded before the rejection
        mediaUpload.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()), Times.Never);
        repo.Verify(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AddReview_WithMoreImagesThanTheLimit_ReturnsBadRequestAndUploadsNothing()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        var mediaUpload = Utilities.MockFactory.MediaUploadService();

        // Act
        var result = await Build(repo, mediaUpload: mediaUpload).AddReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, "text", 4.0M, Images(ReviewService.MaxReviewImages + 1), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        mediaUpload.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()), Times.Never);
        repo.Verify(r => r.AddReviewAsync(It.IsAny<Review>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetOwnReview_WhenTheUserHasOne_ReturnsIt()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByTrailAndUserAsync(Utilities.Identifiers.Trail7, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(Utilities.Stubs.Review(withImages: true)));

        // Act
        var result = await Build(repo).GetOwnReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.Identifier.Should().Be(Utilities.Identifiers.Review5);
        result.Value.ReviewImages.Should().ContainSingle();
    }

    [Fact]
    public async Task GetOwnReview_WhenTheUserHasNone_ReturnsNotFound()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByTrailAndUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.NotFound());

        // Act
        var result = await Build(repo).GetOwnReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetOwnReview_WhenTheLookupFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByTrailAndUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Error());

        // Act
        var result = await Build(repo).GetOwnReviewAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateReview_ByTheAuthor_SavesTheTrimmedTextAndRating()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review());
        ReviewUpdate? saved = null;
        repo.Setup(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()))
            .Callback((ReviewUpdate update, CancellationToken _) => saved = update)
            .ReturnsAsync(RepositoryResult<UpdatedReview>.Success(new UpdatedReview(Utilities.Stubs.Review(), [])));
        var request = new UpdateReviewRequest { Rating = 2M, TrailReview = "  Blöt efter regnet  " };

        // Act
        var result = await Build(repo).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, request, null, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        saved.Should().NotBeNull();
        saved.ReviewId.Should().Be(1);
        saved.TrailReview.Should().Be("Blöt efter regnet");
        saved.Rating.Should().Be(2M);
        saved.RemovedImageIdentifiers.Should().BeEmpty();
        saved.AddedImageUrls.Should().BeEmpty();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateReview_WithBlankText_SavesNoText(string? text)
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review());
        ReviewUpdate? saved = null;
        repo.Setup(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()))
            .Callback((ReviewUpdate update, CancellationToken _) => saved = update)
            .ReturnsAsync(RepositoryResult<UpdatedReview>.Success(new UpdatedReview(Utilities.Stubs.Review(), [])));

        // Act
        await Build(repo).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M, TrailReview = text }, null, TestContext.Current.CancellationToken);

        // Assert
        saved.Should().NotBeNull();
        saved.TrailReview.Should().BeNull();
    }

    [Fact]
    public async Task UpdateReview_WhenNotTheAuthorsReview_ReturnsNotFoundAndUploadsNothing()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.NotFound());
        var mediaUpload = Utilities.MockFactory.MediaUploadService();

        // Act
        var result = await Build(repo, mediaUpload: mediaUpload).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M }, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        mediaUpload.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()), Times.Never);
        repo.Verify(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateReview_WhenLookupFails_ReturnsInternalServerError()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Error());

        // Act
        var result = await Build(repo).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M }, null, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
    }

    [Fact]
    public async Task UpdateReview_RemovingAnImageOfAnotherReview_ReturnsBadRequest()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review(withImages: true));
        var request = new UpdateReviewRequest { Rating = 3M, RemovedImageIdentifiers = ["img-of-someone-else"] };

        // Act
        var result = await Build(repo).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, request, null, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        repo.Verify(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateReview_AddingPastTheImageLimit_ReturnsBadRequestAndUploadsNothing()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review(withImages: true));
        var mediaUpload = Utilities.MockFactory.MediaUploadService();

        // Act
        var result = await Build(repo, mediaUpload: mediaUpload).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M }, Images(ReviewService.MaxReviewImages), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        mediaUpload.Verify(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()), Times.Never);
    }

    [Fact]
    public async Task UpdateReview_ReplacingAnImageUpToTheLimit_UploadsAndSavesBoth()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review(withImages: true));
        ReviewUpdate? saved = null;
        repo.Setup(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()))
            .Callback((ReviewUpdate update, CancellationToken _) => saved = update)
            .ReturnsAsync(RepositoryResult<UpdatedReview>.Success(new UpdatedReview(Utilities.Stubs.Review(), [])));
        var request = new UpdateReviewRequest { Rating = 3M, RemovedImageIdentifiers = ["img-1"] };

        // Act
        var result = await Build(repo).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, request, Images(ReviewService.MaxReviewImages), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        saved.Should().NotBeNull();
        saved.RemovedImageIdentifiers.Should().BeEquivalentTo(["img-1"]);
        saved.AddedImageUrls.Should().HaveCount(ReviewService.MaxReviewImages).And.AllBe("reviews/test-image.jpg");
    }

    [Fact]
    public async Task UpdateReview_DeletesTheFilesOfTheRemovedImages()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review(withImages: true));
        repo.Setup(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UpdatedReview>.Success(new UpdatedReview(Utilities.Stubs.Review(), ["reviews/img.jpg"])));
        var webDav = Utilities.MockFactory.WebDavService();
        var request = new UpdateReviewRequest { Rating = 3M, RemovedImageIdentifiers = ["img-1"] };

        // Act
        var result = await Build(repo, webDav).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, request, null, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        webDav.Verify(w => w.DeleteFileAsync("reviews/img.jpg"), Times.Once);
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task UpdateReview_WhenTheSaveFindsTooManyImages_ReturnsBadRequestAndRollsBack()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review());
        repo.Setup(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UpdatedReview>.Conflict());
        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        var result = await Build(repo, webDav).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M }, Images(1), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(400);
        webDav.Verify(w => w.DeleteFileAsync("reviews/test-image.jpg"), Times.Once);
    }

    [Fact]
    public async Task UpdateReview_WhenSomethingFailsAfterTheSave_KeepsTheNewFiles()
    {
        // Arrange
        var failingUrls = new Mock<IReadOnlyCollection<string>>();
        failingUrls.Setup(c => c.GetEnumerator()).Throws(new InvalidOperationException("after the save"));
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review());
        repo.Setup(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UpdatedReview>.Success(new UpdatedReview(Utilities.Stubs.Review(), failingUrls.Object)));
        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        var result = await Build(repo, webDav).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M }, Images(1), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        webDav.Verify(w => w.DeleteFileAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task UpdateReview_WhenTheSaveFails_RollsBackTheNewUploads()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review());
        repo.Setup(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UpdatedReview>.Error());
        var webDav = Utilities.MockFactory.WebDavService();
        var mediaUpload = new Mock<IMediaUploadService>();
        mediaUpload.SetupSequence(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()))
            .ReturnsAsync(Result.Ok(new UploadedMedia("reviews/new1.jpg", 800, 600, 1234)))
            .ReturnsAsync(Result.Ok(new UploadedMedia("reviews/new2.jpg", 800, 600, 2345)));

        // Act
        var result = await Build(repo, webDav, mediaUpload: mediaUpload).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M }, Utilities.Stubs.TwoImages(), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        webDav.Verify(w => w.DeleteFileAsync("reviews/new1.jpg"), Times.Once);
        webDav.Verify(w => w.DeleteFileAsync("reviews/new2.jpg"), Times.Once);
    }

    [Fact]
    public async Task UpdateReview_WhenTheReviewIsGoneBeforeTheSave_ReturnsNotFoundAndRollsBack()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review());
        repo.Setup(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<UpdatedReview>.NotFound());
        var webDav = Utilities.MockFactory.WebDavService();

        // Act
        var result = await Build(repo, webDav).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M }, Images(1), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(404);
        webDav.Verify(w => w.DeleteFileAsync("reviews/test-image.jpg"), Times.Once);
    }

    [Fact]
    public async Task UpdateReview_WhenAnUploadFails_SavesNothing()
    {
        // Arrange
        var repo = ReviewRepositoryWithStoredReview(Utilities.Stubs.Review());
        var mediaUpload = new Mock<IMediaUploadService>();
        mediaUpload.Setup(m => m.ProcessAndUploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<ImageProcessingOptions>()))
            .ReturnsAsync(Result.Fail<UploadedMedia>(new Message(500, "Upload failed")));

        // Act
        var result = await Build(repo, mediaUpload: mediaUpload).UpdateReviewAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, new UpdateReviewRequest { Rating = 3M }, Images(1), TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeFalse();
        result.Message.Should().NotBeNull();
        result.Message.StatusCode.Should().Be(500);
        repo.Verify(r => r.UpdateReviewAsync(It.IsAny<ReviewUpdate>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    private static Mock<IReviewRepository> ReviewRepositoryWithStoredReview(Review review)
    {
        var repo = new Mock<IReviewRepository>();
        repo.Setup(r => r.GetReviewByIdentifierAsync(Utilities.Identifiers.Review5, Utilities.Identifiers.User, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<Review>.Success(review));
        return repo;
    }

    private static FormFileCollection Images(int count)
    {
        var images = new FormFileCollection();

        for (var i = 0; i < count; i++)
        {
            images.Add(Utilities.Stubs.FakeFile($"img{i}.jpg"));
        }

        return images;
    }

    [Fact]
    public async Task HasUserReviewedTrail_WhenTheUserHasOne_ReturnsTrue()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();
        var service = Build(repo);
        repo.Setup(r => r.HasUserReviewedTrailAsync(It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(true));

        // Act
        var result = await service.HasUserReviewedTrailAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeTrue();
    }

    [Fact]
    public async Task HasUserReviewedTrail_WhenTheUserHasNone_ReturnsFalse()
    {
        // Arrange
        var repo = new Mock<IReviewRepository>();

        // Act
        var result = await Build(repo).HasUserReviewedTrailAsync(Utilities.Identifiers.User, Utilities.Identifiers.Trail7, TestContext.Current.CancellationToken);

        // Assert
        result.Success.Should().BeTrue();
        result.Value.Should().BeFalse();
    }
}
