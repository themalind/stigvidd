using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Logging;

namespace Core.Services;

public class HikeShareService : IHikeShareService
{
    private readonly IHikeShareRepository _hikeShareRepository;
    private readonly IUserRepository _userRepository;
    private readonly IHikeRepository _hikeRepository;
    private readonly IFriendRepository _friendRepository;
    private readonly IPushNotificationService _pushNotificationService;
    private readonly ILogger _logger;

    public HikeShareService(
        IHikeShareRepository hikeShareRepository,
        IUserRepository userRepository,
        IHikeRepository hikeRepository,
        IFriendRepository friendRepository,
        IPushNotificationService pushNotificationService, 
        ILogger<HikeShareService> logger)
    {
        _hikeShareRepository = hikeShareRepository;
        _userRepository = userRepository;
        _hikeRepository = hikeRepository;
        _friendRepository = friendRepository;
        _pushNotificationService = pushNotificationService;
        _logger = logger;
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
        try
        {
            // Get user ID of the sender
            var userIdResult = await _userRepository.GetUserByIdentifierAsync(identifier, u => new SenderProjection(u.Id, u.NickName), ctoken);
            if (!userIdResult.IsSuccess)
            {
                if (userIdResult.Status == RepositoryResultStatus.NotFound)
                    return Result.Fail(new Message(404, "User not found with the given identifier."));

                return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
            }

            // Get user ID of the recipient
            var sharedWithUserIdResult = await _userRepository.GetUserByNickNameAsync(sharedWithName, u => new ReceiverProjection(u.Id, u.Identifier), ctoken);
            if (!sharedWithUserIdResult.IsSuccess)
            {
                if (sharedWithUserIdResult.Status == RepositoryResultStatus.NotFound)
                    return Result.Fail(new Message(404, "User not found with the given name."));

                return Result.Fail(new Message(500, "Something went wrong when fetching user ID."));
            }

            // Make sure the recipient is a friend
            var areFriendsResult = await _friendRepository.FriendshipExistsAsync(userIdResult.Value.Id, sharedWithUserIdResult.Value.Id, ctoken);
            if (!areFriendsResult.IsSuccess)
                return Result.Fail(new Message(500, "Something went wrong when checking friendship status."));

            if (!areFriendsResult.Value)
                return Result.Fail(new Message(403, "You can only share a hike with a friend."));

            // Can not share to yourself
            if (userIdResult.Value.Id == sharedWithUserIdResult.Value.Id)
                return Result.Fail(new Message(400, "You cannot share a hike with yourself."));

            // Get hike by identifier
            var hikeResult = await _hikeRepository.GetHikeByIdentifierAsync(hikeIdentifier, ctoken);
            if (!hikeResult.IsSuccess)
            {
                if (hikeResult.Status == RepositoryResultStatus.NotFound)
                    return Result.Fail(new Message(404, "Hike not found with the given identifier."));

                return Result.Fail(new Message(500, "Something went wrong when fetching hike."));
            }

            // Make sure the sender is the creator of the hike
            if (hikeResult.Value.CreatedBy != identifier)
                return Result.Fail(new Message(403, "You do not have permission to share this hike."));

            var hikeShare = new HikeShare
            {
                SharedById = userIdResult.Value.Id,
                HikeId = hikeResult.Value.Id,
                SharedWithId = sharedWithUserIdResult.Value.Id,
            };

            var result = await _hikeShareRepository.ShareHikeAsync(hikeShare, ctoken);
            if (!result.IsSuccess)
                return Result.Fail(new Message(500, "Something went wrong when sharing the hike."));

            // Send push notification to the recipient
            await _pushNotificationService.SendToUserAsync(
                 sharedWithUserIdResult.Value.Identifier, "Ny delad vandring",
                 $"{userIdResult.Value.NickName} vill dela en vandring med dig",
                  new Dictionary<string, object> { ["type"] = "hike_share" }, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unexpected error occurred while sharing the hike.");
            return Result.Fail(new Message(500, "An unexpected error occurred while sharing the hike."));
        }
    }

    internal record SenderProjection(int Id, string NickName);
    internal record ReceiverProjection(int Id, string Identifier);
}
