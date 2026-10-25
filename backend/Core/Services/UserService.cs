// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Telemetry;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Friend;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IAccountDeletionRepository _accountDeletionRepository;
    private readonly UserResponseFactory _userResponseFactory;
    private readonly IHikeService _hikeService;
    private readonly IWebDavService _webDavService;
    private readonly IUserBlockService _userBlockService;
    private readonly StigviddMetrics _metrics;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository userResponseRepository,
    IAccountDeletionRepository accountDeletionRepository,
    UserResponseFactory userResponseFactory,
    IHikeService hikeService,
    IWebDavService webDavService,
    IUserBlockService userBlockService,
    StigviddMetrics metrics,
    ILogger<UserService> logger)
    {
        _userRepository = userResponseRepository;
        _accountDeletionRepository = accountDeletionRepository;
        _userResponseFactory = userResponseFactory;
        _hikeService = hikeService;
        _webDavService = webDavService;
        _userBlockService = userBlockService;
        _metrics = metrics;
        _logger = logger;
    }

    public async Task<Result<UserResponse?>> GetUserBySubjectAsync(string subjectId, CancellationToken ctoken)
    {
        var result = await _userRepository.GetUserBySubjectAsync(
            subjectId,
            u => UserResponse.Create(u.Identifier, u.NickName, u.Email, null, null, u.Bans.Where(b => b.LiftedAt == null).Select(b => (DateTime?)b.BannedAt).FirstOrDefault()),
            ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while fetching the user."));

        if (!result.IsSuccess)
            return Result.Fail<UserResponse?>(new Message(404, $"User with subject id {subjectId} not found."));

        return Result.Ok<UserResponse?>(result.Value);
    }

    public async Task<Result<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _userRepository.GetUserIdByIdentifierAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<int>(new Message(500, "An error occurred while fetching the user."));

        if (!result.IsSuccess)
            return Result.Fail<int>(new Message(404, $"User with identifier {identifier} not found."));

        return Result.Ok(result.Value);
    }

    public async Task<Result<UserResponse?>> GetUserByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _userRepository.GetUserByIdentifierAsync(
            identifier,
            u => UserResponse.Create(u.Identifier, u.NickName, u.Email, null, null),
            ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while fetching the user."));

        if (!result.IsSuccess)
            return Result.Fail<UserResponse?>(new Message(404, $"User with identifier {identifier} not found."));

        return Result.Ok<UserResponse?>(result.Value);
    }

    public async Task<Result<IReadOnlyCollection<UserFavoritesTrailResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        var result = await _userRepository.GetFavoritesByUserIdentifierAsync(
            userIdentifier,
            t => UserFavoritesTrailResponse.Create(
                t.Identifier,
                t.Name ?? string.Empty,
                t.TrailLength,
                t.City,
                t.Classification,
                t.Accessibility,
                (decimal?)t.GeoPath!.StartPoint.Coordinate.Y,
                (decimal?)t.GeoPath.StartPoint.Coordinate.X,
                t.Reviews!.Select(r => RatingResponse.Create(r.Identifier, r.Rating)).ToList(),
                t.TrailImages!.Select(ti => TrailImageResponse.Create(_userResponseFactory.PresentableBaseUrl, ti.Identifier, ti.ImageUrl)).Take(1).ToList()
            ), ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<IReadOnlyCollection<UserFavoritesTrailResponse?>>(new Message(500, "An error occurred while fetching favorites."));

        return Result.Ok<IReadOnlyCollection<UserFavoritesTrailResponse?>>(result.Value ?? []);
    }

    public async Task<Result<IReadOnlyCollection<UserWishlistTrailResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        var result = await _userRepository.GetWishListByUserIdentifierAsync(
            userIdentifier,
            t => UserWishlistTrailResponse.Create(
                 t.Identifier,
                 t.Name ?? string.Empty,
                 t.TrailLength,
                 t.City,
                 t.Classification,
                 t.Accessibility,
                 (decimal?)t.GeoPath!.StartPoint.Coordinate.Y,
                 (decimal?)t.GeoPath.StartPoint.Coordinate.X,
                 t.Reviews!.Select(r => RatingResponse.Create(r.Identifier, r.Rating)).ToList(),
                 t.TrailImages!.Select(ti => TrailImageResponse.Create(_userResponseFactory.PresentableBaseUrl, ti.Identifier, ti.ImageUrl)).Take(1).ToList()
            ), ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<IReadOnlyCollection<UserWishlistTrailResponse?>>(new Message(500, "An error occurred while fetching wishlist."));

        return Result.Ok<IReadOnlyCollection<UserWishlistTrailResponse?>>(result.Value ?? []);
    }

    public async Task<Result<IReadOnlyCollection<SearchFriendResultResponse>>> FindUsersByNickNameAsync(string username, string currentUserIdentifier, CancellationToken ctoken)
    {
        var hiddenUserIds = await _userBlockService.GetHiddenUserIdsForReadAsync(currentUserIdentifier, ctoken);

        var result = await _userRepository.FindUsersByNickNameAsync(
            username,
            currentUserIdentifier,
            hiddenUserIds,
            u => SearchFriendResultResponse.Create(u.Identifier, u.NickName),
            ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Ok<IReadOnlyCollection<SearchFriendResultResponse>>([]);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<SearchFriendResultResponse>>(new Message(500, "An error occurred while searching for the user."));

        return Result.Ok(result.Value);
    }

    public async Task<Result<UserNameResponse>> CheckForUsername(string username, CancellationToken ctoken)
    {
        var result = await _userRepository.CheckForUsername(username, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<UserNameResponse>(new Message(500, "An error occurred while checking username."));

        return Result.Ok(UserNameResponse.Create(username, result.Value));
    }

    public async Task<Result<UserResponse?>> CreateUserAsync(string email, string nickName, string subjectId, CancellationToken ctoken)
    {
        var nicknameCheck = await _userRepository.CheckUserNicknameAvaliability(nickName, ctoken);
        if (!nicknameCheck.IsSuccess)
        {
            if (nicknameCheck.Status == RepositoryResultStatus.Conflict)
                return Result.Fail<UserResponse?>(new Message(409, $"Nickname {nickName} is already taken."));

            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while creating the user."));
        }

        var existing = await _userRepository.GetUserBySubjectAsync(subjectId, u => u.Identifier, ctoken);

        if (existing.Status == RepositoryResultStatus.Error)
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while creating the user."));

        if (existing.IsSuccess)
            return Result.Fail<UserResponse?>(new Message(409, $"User with identifier {subjectId} already exists."));

        var newUser = new User
        {
            SubjectId = subjectId,
            NickName = nickName,
            Email = email,
            MyFavorites = [],
            MyWishList = []
        };

        var createResult = await _userRepository.CreateUserAsync(newUser, ctoken);

        if (!createResult.IsSuccess)
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while creating the user."));

        var userResponse = _userResponseFactory.Create(newUser);
        return Result.Ok<UserResponse?>(userResponse);
    }

    public async Task<Result<UserFavoritesTrailResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        var result = await _userRepository.AddTrailToUserFavoritesListAsync(
            userIdentifier,
            trailIdentifier,
            t => UserFavoritesTrailResponse.Create(
                t.Identifier,
                t.Name ?? string.Empty,
                t.TrailLength,
                t.City,
                t.Classification,
                t.Accessibility,
                (decimal?)t.GeoPath!.StartPoint.Coordinate.Y,
                (decimal?)t.GeoPath.StartPoint.Coordinate.X,
                t.Reviews!.Select(r => RatingResponse.Create(r.Identifier, r.Rating)).ToList(),
                t.TrailImages!.Select(ti => TrailImageResponse.Create(_userResponseFactory.PresentableBaseUrl, ti.Identifier, ti.ImageUrl)).Take(1).ToList()
            ), ctoken);

        _metrics.RecordCollectionChange(
            MetricTags.Values.ListFavorites,
            MetricTags.Values.OperationAdd,
            MetricOutcome.From(result.Status));

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<UserFavoritesTrailResponse?>(new Message(500, "An error occurred while adding trail to favorites."));

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<UserFavoritesTrailResponse?>(new Message(404, $"Failed to add trail {trailIdentifier} to favorites for user {userIdentifier}."));

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<UserFavoritesTrailResponse?>(new Message(409, $"Trail {trailIdentifier} already in favorites for user {userIdentifier}."));

        return Result.Ok(result.Value);
    }

    public async Task<Result<UserWishlistTrailResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        var result = await _userRepository.AddTrailToUserWishListAsync(
            userIdentifier,
            trailIdentifier,
            t => UserWishlistTrailResponse.Create(
                 t.Identifier,
                 t.Name ?? string.Empty,
                 t.TrailLength,
                 t.City,
                 t.Classification,
                 t.Accessibility,
                 (decimal?)t.GeoPath!.StartPoint.Coordinate.Y,
                 (decimal?)t.GeoPath.StartPoint.Coordinate.X,
                 t.Reviews!.Select(r => RatingResponse.Create(r.Identifier, r.Rating)).ToList(),
                 t.TrailImages!.Select(ti => TrailImageResponse.Create(_userResponseFactory.PresentableBaseUrl, ti.Identifier, ti.ImageUrl)).Take(1).ToList()
            ), ctoken);

        _metrics.RecordCollectionChange(
            MetricTags.Values.ListWishlist,
            MetricTags.Values.OperationAdd,
            MetricOutcome.From(result.Status));

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<UserWishlistTrailResponse?>(new Message(500, "An error occurred while adding trail to wishlist."));

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail<UserWishlistTrailResponse?>(new Message(404, $"Failed to add trail {trailIdentifier} to wishlist for user {userIdentifier}."));

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail<UserWishlistTrailResponse?>(new Message(409, $"Trail {trailIdentifier} already in wishlist for user {userIdentifier}."));

        return Result.Ok(result.Value);
    }

    public async Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        var result = await _userRepository.RemoveTrailFromUserFavoritesListAsync(userIdentifier, trailIdentifier, ctoken);

        _metrics.RecordCollectionChange(
            MetricTags.Values.ListFavorites,
            MetricTags.Values.OperationRemove,
            MetricOutcome.From(result.Status));

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while removing trail from favorites."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Failed to remove trail {trailIdentifier} from favorites for user {userIdentifier}."));

        return Result.Ok();
    }

    public async Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        var result = await _userRepository.RemoveTrailFromUserWishListAsync(userIdentifier, trailIdentifier, ctoken);

        _metrics.RecordCollectionChange(
            MetricTags.Values.ListWishlist,
            MetricTags.Values.OperationRemove,
            MetricOutcome.From(result.Status));

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while removing trail from wishlist."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Failed to remove trail {trailIdentifier} from wishlist for user {userIdentifier}."));

        return Result.Ok();
    }

    public async Task<Result> DeleteUserAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _accountDeletionRepository.DeleteAccountAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, $"User with identifier {identifier} not found."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, $"Error deleting user with identifier {identifier}"));

        _logger.LogInformation("UserService: DeleteUserAsync -> deleted user {UserIdentifier}.", identifier);

        await DeleteFilesAsync(result.Value.FileUrls, $"Account deletion. UserId: {result.Value.UserId}");
        await _hikeService.CleanUpOrphanedHikesAsync(ctoken);

        return Result.Ok();
    }

    // keep-comment: best-effort; the account is already gone, and a leftover file is only findable through this log.
    private async Task DeleteFilesAsync(IEnumerable<string> urls, string context)
    {
        foreach (var url in urls)
        {
            try
            {
                var result = await _webDavService.DeleteFileAsync(url);

                if (result.IsFailure)
                    _logger.LogError("UserService: DeleteUserAsync -> WebDAV refused to delete file {Url}. {Context}", url, context);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "UserService: DeleteUserAsync -> Failed to delete file {Url}. {Context}", url, context);
            }
        }
    }
}
