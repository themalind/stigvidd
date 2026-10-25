// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using WebDataContracts.ResponseModels.Friend;

namespace Core.Services;

public class FriendProfileService : IFriendProfileService
{
    private readonly IUserRepository _userRepository;
    private readonly IFriendRepository _friendRepository;
    private readonly IUserBlockService _userBlockService;
    private readonly IReviewRepository _reviewRepository;
    private readonly ITrailRepository _trailRepository;
    private readonly TrailResponseFactory _trailResponseFactory;

    public FriendProfileService(
        IUserRepository userRepository,
        IFriendRepository friendRepository,
        IUserBlockService userBlockService,
        IReviewRepository reviewRepository,
        ITrailRepository trailRepository,
        TrailResponseFactory trailResponseFactory)
    {
        _userRepository = userRepository;
        _friendRepository = friendRepository;
        _userBlockService = userBlockService;
        _reviewRepository = reviewRepository;
        _trailRepository = trailRepository;
        _trailResponseFactory = trailResponseFactory;
    }

    public async Task<Result<FriendProfileResponse>> GetProfileAsync(string currentUserIdentifier, string friendIdentifier, CancellationToken ctoken)
    {
        var currentUserIdResult = await _userRepository.GetUserIdByIdentifierAsync(currentUserIdentifier, ctoken);
        if (!currentUserIdResult.IsSuccess)
        {
            if (currentUserIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<FriendProfileResponse>(new Message(404, "Current user not found."));

            return Result.Fail<FriendProfileResponse>(new Message(500, "An error occurred while retrieving the current user."));
        }

        var friendIdResult = await _userRepository.GetUserIdByIdentifierAsync(friendIdentifier, ctoken);
        if (!friendIdResult.IsSuccess)
        {
            if (friendIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<FriendProfileResponse>(new Message(404, "Friend not found."));

            return Result.Fail<FriendProfileResponse>(new Message(500, "An error occurred while retrieving the user."));
        }

        var friendId = friendIdResult.Value;
        var areFriendsResult = await _friendRepository.FriendshipExistsAsync(currentUserIdResult.Value, friendId, ctoken);
        if (!areFriendsResult.IsSuccess)
            return Result.Fail<FriendProfileResponse>(new Message(500, "An error occurred while checking friendship status."));

        var hiddenUserIds = await _userBlockService.GetHiddenUserIdsForReadAsync(currentUserIdentifier, ctoken);

        // keep-comment: same answer for a stranger, a blocked friend and an unknown user, so the endpoint cannot probe either
        if (!areFriendsResult.Value || hiddenUserIds.Contains(friendId))
            return Result.Fail<FriendProfileResponse>(new Message(404, "Friend not found."));

        var reviewsResult = await _reviewRepository.GetReviewsByUserIdAsync(friendId, r => new FriendReviewResponse
        {
            Identifier = r.Identifier,
            TrailIdentifier = r.Trail == null ? "" : r.Trail.Identifier,
            TrailName = r.Trail == null ? "" : r.Trail.Name,
            Rating = r.Rating,
            Text = r.TrailReview,
            CreatedAt = r.CreatedAt,
        }, ctoken);
        if (!reviewsResult.IsSuccess || reviewsResult.Value is null)
            return Result.Fail<FriendProfileResponse>(new Message(500, "An error occurred while fetching the friend's reviews."));

        var trailsResult = await _trailRepository.GetTrailsCreditedToUserAsync(friendId, ctoken);
        if (!trailsResult.IsSuccess || trailsResult.Value is null)
            return Result.Fail<FriendProfileResponse>(new Message(500, "An error occurred while fetching the friend's trails."));

        var baseUrl = _trailResponseFactory.PresentableBaseUrl;

        return Result.Ok(new FriendProfileResponse
        {
            Reviews = [.. reviewsResult.Value],
            PublishedTrails = [.. trailsResult.Value.Select(t => new FriendPublishedTrailResponse
            {
                Identifier = t.Identifier,
                Name = t.Name,
                TrailLength = t.TrailLength,
                City = t.City,
                ImageUrl = t.ImageUrl is null ? null : baseUrl + t.ImageUrl,
                PublishedAt = t.PublishedAt,
            })],
        });
    }
}
