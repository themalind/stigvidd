// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using System.Linq.Expressions;
using AwesomeAssertions;
using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Projections;
using Core.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Moq;
using WebDataContracts.ResponseModels.Friend;

namespace UnitTests.ServiceTests;

public class FriendProfileServiceTests
{
    private const int MeId = 1;
    private const int FriendId = 2;

    private readonly Mock<IReviewRepository> _reviews = new();
    private readonly Mock<ITrailRepository> _trails = new();

    private FriendProfileService Build(bool areFriends = true, params int[] hiddenUserIds)
    {
        var users = new Mock<IUserRepository>();
        users.Setup(r => r.GetUserIdByIdentifierAsync("me", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(MeId));
        users.Setup(r => r.GetUserIdByIdentifierAsync("anna", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.Success(FriendId));
        users.Setup(r => r.GetUserIdByIdentifierAsync("nobody", It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<int>.NotFound());

        var friends = new Mock<IFriendRepository>();
        friends.Setup(r => r.FriendshipExistsAsync(MeId, FriendId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<bool>.Success(areFriends));

        _reviews.Setup(r => r.GetReviewsByUserIdAsync(FriendId, It.IsAny<Expression<Func<Review, FriendReviewResponse>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<FriendReviewResponse>>.Success(
                [new FriendReviewResponse { Identifier = "r1", TrailIdentifier = "t1", TrailName = "Rya åsar", Rating = 4 }]));
        _trails.Setup(r => r.GetTrailsCreditedToUserAsync(FriendId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(RepositoryResult<IReadOnlyCollection<ContributedTrailProjection>>.Success(
            [
                new ContributedTrailProjection("t2", "Hålsjöleden", 7.8m, "Borås", "trails/a.jpg", DateTime.UtcNow),
                new ContributedTrailProjection("t3", "Utan bild", 2m, "Borås", null, DateTime.UtcNow),
            ]));

        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("https://media.example/");

        return new FriendProfileService(
            users.Object,
            friends.Object,
            Utilities.MockFactory.UserBlockServiceHiding(hiddenUserIds).Object,
            _reviews.Object,
            _trails.Object,
            new TrailResponseFactory(cfg.Object));
    }

    [Fact]
    public async Task GetProfileAsync_GivesAFriendsReviewsAndCreditedTrails()
    {
        var result = await Build().GetProfileAsync("me", "anna", TestContext.Current.CancellationToken);

        result.Success.Should().BeTrue();
        var profile = result.Value;
        profile.Should().NotBeNull();
        if (profile is null) return;
        profile.Reviews.Select(r => r.TrailName).Should().Equal("Rya åsar");
        profile.PublishedTrails.Select(t => t.ImageUrl).Should().Equal("https://media.example/trails/a.jpg", null);
    }

    [Fact]
    public async Task GetProfileAsync_ForSomeoneWhoIsNotAFriend_ReturnsNotFoundAndReadsNothing()
    {
        var result = await Build(areFriends: false).GetProfileAsync("me", "anna", TestContext.Current.CancellationToken);

        result.Success.Should().BeFalse();
        result.Message?.StatusCode.Should().Be(404);
        _reviews.VerifyNoOtherCalls();
        _trails.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetProfileAsync_ForABlockedFriend_ReturnsNotFound()
    {
        var result = await Build(true, FriendId).GetProfileAsync("me", "anna", TestContext.Current.CancellationToken);

        result.Success.Should().BeFalse();
        result.Message?.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GetProfileAsync_ForAnUnknownUser_ReturnsNotFound()
    {
        var result = await Build().GetProfileAsync("me", "nobody", TestContext.Current.CancellationToken);

        result.Message?.StatusCode.Should().Be(404);
    }
}
