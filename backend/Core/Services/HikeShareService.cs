using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;

namespace Core.Services;

public class HikeShareService : IHikeShareService
{
    private readonly IHikeShareRepository _hikeShareRepository;
    private readonly IUserRepository _userRepository;
    private readonly IHikeRepository _hikeRepository;
    private readonly IFriendRepository _friendRepository;

    public HikeShareService(IHikeShareRepository hikeShareRepository, IUserRepository userRepository, IHikeRepository hikeRepository, IFriendRepository friendRepository)
    {
        _hikeShareRepository = hikeShareRepository;
        _userRepository = userRepository;
        _hikeRepository = hikeRepository;
        _friendRepository = friendRepository;
    }

    public async Task<Result<int>> GetHikeShareCountAsync(string identifier, string hikeIdentifier, CancellationToken ctoken)
    {
        var result = await _hikeShareRepository.GetHikeShareCountAsync(identifier, hikeIdentifier, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<int>(new Message(500, "Something went wrong when fetching hike share count."));

        return Result.Ok<int>(result.Value);
    }

    public async Task<Result> ShareHikeAsync(string identifier, string hikeIdentifier, string sharedWithName, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(identifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
        }

        var sharedWithUserIdResult = await _userRepository.GetUserByNickNameAsync(sharedWithName, u => u.Id, ctoken);
        if (!sharedWithUserIdResult.IsSuccess)
        {
            if (sharedWithUserIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found with the given name."));

            return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
        }

        // Make sure the recipient is a friend
        var areFriendsResult = await _friendRepository.FriendshipExistsAsync(userIdResult.Value, sharedWithUserIdResult.Value, ctoken);
        if (!areFriendsResult.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong when checking friendship status."));

        if (!areFriendsResult.Value)
            return Result.Fail(new Message(403, "You can only share a hike with a friend."));

        // Can not share to yourself
        if (userIdResult.Value == sharedWithUserIdResult.Value)
            return Result.Fail(new Message(400, "You cannot share a hike with yourself."));

        var hikeResult = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);
        if (!hikeResult.IsSuccess)
        {
            if (hikeResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Hike not found with the given identifier."));

            return Result.Fail(new Message(500, "Something went wrong when fetching hike."));
        }

        if (hikeResult.Value.CreatedBy != identifier)
            return Result.Fail(new Message(403, "You do not have permission to share this hike."));

        var hikeShare = new HikeShare
        {
            SharedById = userIdResult.Value,
            HikeId = hikeResult.Value.Id,
            SharedWithId = sharedWithUserIdResult.Value,
        };

        var result = await _hikeShareRepository.ShareHikeAsync(hikeShare, ctoken);
        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "Something went wrong when sharing the hike."));

        return Result.Ok();
    }
}
