using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Services;

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly ITrailObstacleRepository _trailObstacleRepository;
    private readonly UserResponseFactory _userResponseFactory;
    private readonly IHikeService _hikeService;

    public UserService(IUserRepository userResponseRepository,
    ITrailObstacleRepository trailObstacleRepository,
    UserResponseFactory userResponseFactory, IHikeService hikeService)
    {
        _userRepository = userResponseRepository;
        _trailObstacleRepository = trailObstacleRepository;
        _userResponseFactory = userResponseFactory;
        _hikeService = hikeService;
    }

    public async Task<Result<UserResponse?>> GetUserByFirebaseUidAsync(string firebaseUid, CancellationToken ctoken)
    {
        var result = await _userRepository.GetUserByFirebaseUidAsync(
            firebaseUid,
            u => UserResponse.Create(u.Identifier, u.NickName, u.Email),
            ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while fetching the user."));

        if (!result.IsSuccess)
            return Result.Fail<UserResponse?>(new Message(404, $"User with Firebase UID {firebaseUid} not found."));

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
                 t.Description ?? string.Empty,
                 t.Reviews!.Select(r => new RatingResponse { Identifier = r.Identifier, Rating = r.Rating }).ToList(),
                 t.TrailImages!.Select(ti => new TrailImageResponse { Identifier = ti.Identifier, ImageUrl = ti.ImageUrl }).Take(1)
            .ToList()), ctoken);

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
                 t.Description ?? string.Empty,
                 t.Reviews!.Select(r => new RatingResponse { Identifier = r.Identifier, Rating = r.Rating }).ToList(),
                 t.TrailImages!.Select(ti => new TrailImageResponse { Identifier = ti.Identifier, ImageUrl = ti.ImageUrl }).Take(1)
            .ToList()), ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<IReadOnlyCollection<UserWishlistTrailResponse?>>(new Message(500, "An error occurred while fetching wishlist."));

        return Result.Ok<IReadOnlyCollection<UserWishlistTrailResponse?>>(result.Value ?? []);
    }

    public async Task<Result<UserResponse?>> CreateUserAsync(string email, string nickName, string firebaseUid, CancellationToken ctoken)
    {
        var existing = await _userRepository.GetUserByFirebaseUidAsync(firebaseUid, u => u.Identifier, ctoken);

        if (existing.Status == RepositoryResultStatus.Error)
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while creating the user."));

        if (existing.IsSuccess)
            return Result.Fail<UserResponse?>(new Message(409, $"User with identifier {firebaseUid} already exists."));

        var newUser = new User
        {
            FirebaseUid = firebaseUid,
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
                t.Description ?? string.Empty,
                t.Reviews!.Select(r => new RatingResponse { Identifier = r.Identifier, Rating = r.Rating }).ToList(),
                t.TrailImages!.Select(ti => new TrailImageResponse { Identifier = ti.Identifier, ImageUrl = ti.ImageUrl }).Take(1)
            .ToList()), ctoken);

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
                 t.Description ?? string.Empty,
                 t.Reviews!.Select(r => new RatingResponse { Identifier = r.Identifier, Rating = r.Rating }).ToList(),
                 t.TrailImages!.Select(ti => new TrailImageResponse { Identifier = ti.Identifier, ImageUrl = ti.ImageUrl }).Take(1).ToList()
            ), ctoken);

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

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while removing trail from favorites."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Failed to remove trail {trailIdentifier} from favorites for user {userIdentifier}."));

        return Result.Ok();
    }

    public async Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        var result = await _userRepository.RemoveTrailFromUserWishListAsync(userIdentifier, trailIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while removing trail from wishlist."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Failed to remove trail {trailIdentifier} from wishlist for user {userIdentifier}."));

        return Result.Ok();
    }

    public async Task<Result> DeleteUserAsync(string identifier, CancellationToken ctoken)
    {
        var userResult = await _userRepository.GetUserIdByIdentifierAsync(identifier, ctoken);

        if (!userResult.IsSuccess)
        {
            if (userResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, $"User with identifier {identifier} not found."));

            if (userResult.Status == RepositoryResultStatus.Error)
                return Result.Fail(new Message(500, $"Error deleting user with identifier {identifier}"));
        }

        var hikeResult = await _hikeService.HandleUserHikesOnUserDeleteAsync(userResult.Value, ctoken);

        if (!hikeResult.Success)
            return Result.Fail(new Message(500, $"Error deleting user with identifier {identifier}"));

        var sharedHikesResult = await _hikeService.DeleteHikeSharesByUserIdAsync(userResult.Value, ctoken);

        if (!sharedHikesResult.Success)
            return Result.Fail(new Message(500, $"Error deleting user with identifier {identifier}"));

        // Reviews cascade at the DB level (OnDelete Cascade), so they are removed automatically when the user is deleted.
        // TrailObstacles use NoAction to avoid multiple cascade paths, so they must be removed explicitly before the user is deleted.
        var obstacleResult = await _trailObstacleRepository.DeleteAllObstaclesByUserIdAsync(userResult.Value, ctoken);

        if (obstacleResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, $"Error deleting user with identifier {identifier}"));

        var result = await _userRepository.DeleteUserAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, $"Error deleting user with identifier {identifier}"));

        return Result.Ok();
    }
}
