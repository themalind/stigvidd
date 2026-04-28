using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.User;

namespace Core.Services;

public class UserService : IUserService
{
    private readonly IUserResponseRepository _userResponseRepository;
    private readonly ILogger<UserService> _logger;
    private readonly UserResponseFactory _userResponseFactory;

    public UserService(IUserResponseRepository userResponseRepository,
    ILogger<UserService> logger,
    UserResponseFactory userResponseFactory)
    {
        _userResponseRepository = userResponseRepository;
        _logger = logger;
        _userResponseFactory = userResponseFactory;
    }

    public async Task<Result<UserResponse?>> GetUserByFirebaseUidAsync(string firebaseUid, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.GetUserByFirebaseUidAsync(firebaseUid, ctoken);

            if (!result.IsSuccess)
            {
                _logger.LogWarning("User with Firebase UID {firebaseUid} not found.", firebaseUid);
                return Result.Fail<UserResponse?>(new Message(404, $"User with Firebase UID {firebaseUid} not found."));
            }

            return Result.Ok<UserResponse?>(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user with Firebase UID {firebaseUid}", firebaseUid);
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while fetching the user."));
        }
    }

    public async Task<Result<int>> GetUserIdByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.GetUserIdByIdentifierAsync(identifier, ctoken);

            if (!result.IsSuccess)
            {
                _logger.LogWarning("User with identifier {identifier} not found.", identifier);
                return Result.Fail<int>(new Message(404, $"User with identifier {identifier} not found."));
            }

            return Result.Ok(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user ID with identifier {identifier}", identifier);
            return Result.Fail<int>(new Message(500, "An error occurred while fetching the user."));
        }
    }

    public async Task<Result<UserResponse?>> GetUserByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.GetUserByIdentifierAsync(identifier, ctoken);

            if (!result.IsSuccess)
            {
                _logger.LogWarning("User with identifier {identifier} not found.", identifier);
                return Result.Fail<UserResponse?>(new Message(404, $"User with identifier {identifier} not found."));
            }

            return Result.Ok<UserResponse?>(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching user with identifier {identifier}", identifier);
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while fetching the user."));
        }
    }

    public async Task<Result<IReadOnlyCollection<UserFavoritesTrailResponse?>>> GetFavoritesByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.GetFavoritesByUserIdentifierAsync(userIdentifier, ctoken);

            return Result.Ok<IReadOnlyCollection<UserFavoritesTrailResponse?>>(result.Value!);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching favorites for user {userIdentifier}", userIdentifier);
            return Result.Fail<IReadOnlyCollection<UserFavoritesTrailResponse?>>(new Message(500, "An error occurred while fetching favorites."));
        }
    }

    public async Task<Result<IReadOnlyCollection<UserWishlistTrailResponse?>>> GetWishListByUserIdentifierAsync(string userIdentifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.GetWishListByUserIdentifierAsync(userIdentifier, ctoken);

            return Result.Ok<IReadOnlyCollection<UserWishlistTrailResponse?>>(result.Value!);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching wishlist for user {userIdentifier}", userIdentifier);
            return Result.Fail<IReadOnlyCollection<UserWishlistTrailResponse?>>(new Message(500, "An error occurred while fetching wishlist."));
        }
    }

    public async Task<Result<UserResponse?>> CreateUserAsync(string email, string nickName, string firebaseUid, CancellationToken ctoken)
    {
        try
        {
            var existing = await _userResponseRepository.GetUserByFirebaseUidAsync(firebaseUid, ctoken);

            if (existing.IsSuccess)
            {
                _logger.LogWarning("User with identifier {firebaseUid} already exists.", firebaseUid);
                return Result.Fail<UserResponse?>(new Message(409, $"User with identifier {firebaseUid} already exists."));
            }

            var newUser = new User
            {
                FirebaseUid = firebaseUid,
                NickName = nickName,
                Email = email,
                MyFavorites = [],
                MyWishList = []
            };

            await _userResponseRepository.CreateUserAsync(newUser, ctoken);

            var userResponse = _userResponseFactory.Create(newUser);
            return Result.Ok<UserResponse?>(userResponse);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user with Firebase UID {firebaseUid}", firebaseUid);
            return Result.Fail<UserResponse?>(new Message(500, "An error occurred while creating the user."));
        }
    }

    public async Task<Result<UserFavoritesTrailResponse?>> AddTrailToUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.AddTrailToUserFavoritesListAsync(userIdentifier, trailIdentifier, ctoken);

            if (result.Status == RepositoryResultStatus.NotFound)
            {
                _logger.LogWarning("Failed to add trail {trailIdentifier} to favorites for user {userIdentifier}.", trailIdentifier, userIdentifier);
                return Result.Fail<UserFavoritesTrailResponse?>(new Message(404, $"Failed to add trail {trailIdentifier} to favorites for user {userIdentifier}."));
            }

            if (result.Status == RepositoryResultStatus.Conflict)
            {
                _logger.LogWarning("Trail {trailIdentifier} already in favorites for user {userIdentifier}.", trailIdentifier, userIdentifier);
                return Result.Fail<UserFavoritesTrailResponse?>(new Message(409, $"Trail {trailIdentifier} already in favorites for user {userIdentifier}."));
            }

            return Result.Ok(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding trail {trailIdentifier} to favorites for user {userIdentifier}", trailIdentifier, userIdentifier);
            return Result.Fail<UserFavoritesTrailResponse?>(new Message(500, "An error occurred while adding trail to favorites."));
        }
    }

    public async Task<Result<UserWishlistTrailResponse?>> AddTrailToUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.AddTrailToUserWishListAsync(userIdentifier, trailIdentifier, ctoken);

            if (result.Status == RepositoryResultStatus.NotFound)
            {
                _logger.LogWarning("Failed to add trail {trailIdentifier} to wishlist for user {userIdentifier}.", trailIdentifier, userIdentifier);
                return Result.Fail<UserWishlistTrailResponse?>(new Message(404, $"Failed to add trail {trailIdentifier} to wishlist for user {userIdentifier}."));
            }

            if (result.Status == RepositoryResultStatus.Conflict)
            {
                _logger.LogWarning("Trail {trailIdentifier} already in wishlist for user {userIdentifier}.", trailIdentifier, userIdentifier);
                return Result.Fail<UserWishlistTrailResponse?>(new Message(409, $"Trail {trailIdentifier} already in wishlist for user {userIdentifier}."));
            }

            return Result.Ok(result.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding trail {trailIdentifier} to wishlist for user {userIdentifier}", trailIdentifier, userIdentifier);
            return Result.Fail<UserWishlistTrailResponse?>(new Message(500, "An error occurred while adding trail to wishlist."));
        }
    }

    public async Task<Result> RemoveTrailFromUserFavoritesListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.RemoveTrailFromUserFavoritesListAsync(userIdentifier, trailIdentifier, ctoken);

            if (!result.IsSuccess)
            {
                _logger.LogWarning("Failed to remove trail {trailIdentifier} from favorites for user {userIdentifier}.", trailIdentifier, userIdentifier);
                return Result.Fail(new Message(404, $"Failed to remove trail {trailIdentifier} from favorites for user {userIdentifier}."));
            }

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing trail {trailIdentifier} from favorites for user {userIdentifier}", trailIdentifier, userIdentifier);
            return Result.Fail(new Message(500, "An error occurred while removing trail from favorites."));
        }
    }

    public async Task<Result> RemoveTrailFromUserWishListAsync(string userIdentifier, string trailIdentifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.RemoveTrailFromUserWishListAsync(userIdentifier, trailIdentifier, ctoken);

            if (!result.IsSuccess)
            {
                _logger.LogWarning("Failed to remove trail {trailIdentifier} from wishlist for user {userIdentifier}.", trailIdentifier, userIdentifier);
                return Result.Fail(new Message(404, $"Failed to remove trail {trailIdentifier} from wishlist for user {userIdentifier}."));
            }

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing trail {trailIdentifier} from wishlist for user {userIdentifier}", trailIdentifier, userIdentifier);
            return Result.Fail(new Message(500, "An error occurred while removing trail from wishlist."));
        }
    }

    public async Task<Result> DeleteUserAsync(string identifier, CancellationToken ctoken)
    {
        try
        {
            var result = await _userResponseRepository.DeleteUserAsync(identifier, ctoken);

            if (result.Status == RepositoryResultStatus.NotFound)
            {
                _logger.LogWarning("User with identifier {identifier} not found.", identifier);
                return Result.Fail(new Message(404, $"User with identifier {identifier} not found."));
            }

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user with identifier {identifier}", identifier);
            return Result.Fail(new Message(500, $"Error deleting user with identifier {identifier}"));
        }
    }
}
