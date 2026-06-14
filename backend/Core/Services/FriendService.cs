using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Friend;

namespace Core.Services;

public class FriendService : IFriendService
{
    private readonly IFriendRepository _friendRepository;
    private readonly IUserRepository _userRepository;
    private readonly IPushNotificationService _pushNotificationService;
    private readonly ILogger _logger;

    public FriendService(
        IFriendRepository friendRepository,
        IUserRepository userRepository,
        IPushNotificationService pushNotificationService,
        ILogger<FriendService> logger)
    {
        _friendRepository = friendRepository;
        _userRepository = userRepository;
        _pushNotificationService = pushNotificationService;
        _logger = logger;
    }

    public async Task<Result> AcceptFriendRequestAsync(string currentUserIdentifier, string requesterIdentifier, CancellationToken ctoken)
    {
        var currentUserIdResult = await _userRepository.GetUserIdByIdentifierAsync(currentUserIdentifier, ctoken);
        if (!currentUserIdResult.IsSuccess)
        {
            if (currentUserIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Current user not found."));

            return Result.Fail(new Message(500, "An error occurred while retrieving the current user."));
        }

        var requesterIdResult = await _userRepository.GetUserIdByIdentifierAsync(requesterIdentifier, ctoken);
        if (!requesterIdResult.IsSuccess)
        {
            if (requesterIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Requester user not found."));

            return Result.Fail(new Message(500, "An error occurred while retrieving the requester user."));
        }

        var result = await _friendRepository.AcceptRequestAsync(requesterIdResult.Value, currentUserIdResult.Value, ctoken);
        if (!result.IsSuccess)
        {
            if (result.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Friend request not found."));

            return Result.Fail(new Message(500, "An error occurred while accepting the friend request."));
        }

        await _pushNotificationService.SendToUserAsync(
            requesterIdentifier,
            "Vänförfrågan accepterad",
            "Din vänförfrågan har accepterats",
            new Dictionary<string, object> { ["type"] = "friend_request_accepted" },
            ctoken);

        return Result.Ok();
    }

    public async Task<Result<IEnumerable<FriendResponse>>> GetFriendsAsync(string currentUserIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(currentUserIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<IEnumerable<FriendResponse>>(new Message(404, "User not found."));

            return Result.Fail<IEnumerable<FriendResponse>>(new Message(500, "An error occurred while retrieving the user."));
        }

        var result = await _friendRepository.GetFriendsAsync(
            userIdResult.Value,
            u => FriendResponse.Create(u.Identifier, u.NickName),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IEnumerable<FriendResponse>>(new Message(500, "An error occurred while fetching friends."));

        return Result.Ok(result.Value);
    }

    public async Task<Result<IEnumerable<FriendRequestResponse>>> GetIncomingRequestsAsync(string currentUserIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(currentUserIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<IEnumerable<FriendRequestResponse>>(new Message(404, "User not found."));

            return Result.Fail<IEnumerable<FriendRequestResponse>>(new Message(500, "An error occurred while retrieving the user."));
        }

        var result = await _friendRepository.GetIncomingRequestsAsync(
            userIdResult.Value,
            u => FriendRequestResponse.Create(u.Requester!.Identifier, u.Requester.NickName, u.CreatedAt),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IEnumerable<FriendRequestResponse>>(new Message(500, "An error occurred while fetching incoming friend requests."));

        return Result.Ok(result.Value);
    }

    public async Task<Result<IEnumerable<OutgoingFriendRequestResponse>>> GetOutgoingRequestsAsync(string currentUserIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(currentUserIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<IEnumerable<OutgoingFriendRequestResponse>>(new Message(404, "User not found."));

            return Result.Fail<IEnumerable<OutgoingFriendRequestResponse>>(new Message(500, "An error occurred while retrieving the user."));
        }

        var result = await _friendRepository.GetOutgoingRequestsAsync(
            userIdResult.Value,
            u => OutgoingFriendRequestResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName, u.CreatedAt),
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IEnumerable<OutgoingFriendRequestResponse>>(new Message(500, "An error occurred while fetching outgoing friend requests."));

        return Result.Ok(result.Value);
    }

    public async Task<Result> RemoveConnectionAsync(string currentUserIdentifier, string otherIdentifier, CancellationToken ctoken)
    {
        var currentUserIdResult = await _userRepository.GetUserIdByIdentifierAsync(currentUserIdentifier, ctoken);
        if (!currentUserIdResult.IsSuccess)
        {
            if (currentUserIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Current user not found."));

            return Result.Fail(new Message(500, "An error occurred while retrieving the current user."));
        }

        var otherIdResult = await _userRepository.GetUserIdByIdentifierAsync(otherIdentifier, ctoken);
        if (!otherIdResult.IsSuccess)
        {
            if (otherIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "User not found."));

            return Result.Fail(new Message(500, "An error occurred while retrieving the user."));
        }

        var result = await _friendRepository.RemoveFriendShipOrFriendRequestAsync(currentUserIdResult.Value, otherIdResult.Value, ctoken);

        if (!result.IsSuccess)
        {
            if (result.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Connection not found."));

            return Result.Fail(new Message(500, "An error occurred while removing the connection."));
        }

        return Result.Ok();
    }

    public async Task<Result> SendFriendRequestAsync(string currentUserIdentifier, string receiverNickName, CancellationToken ctoken)
    {
        try
        {
            var currentUserIdResult = await _userRepository.GetUserByIdentifierAsync(currentUserIdentifier, u => new SenderProjection(u.Id, u.NickName), ctoken);
            if (!currentUserIdResult.IsSuccess)
            {
                if (currentUserIdResult.Status == RepositoryResultStatus.NotFound)
                    return Result.Fail(new Message(404, "Current user not found."));
                return Result.Fail(new Message(500, "An error occurred while retrieving the current user."));
            }

            var receiverResult = await _userRepository.GetUserByNickNameAsync(receiverNickName, u => new ReceiverProjection(u.Id, u.Identifier), ctoken);
            if (!receiverResult.IsSuccess)
            {
                if (receiverResult.Status == RepositoryResultStatus.NotFound)
                    return Result.Fail(new Message(404, "Receiver not found."));
                return Result.Fail(new Message(500, "An error occurred while retrieving the receiver."));
            }

            if (currentUserIdResult.Value.Id == receiverResult.Value.Id)
                return Result.Fail(new Message(400, "You cannot send a friend request to yourself."));

            var friendshipExistsResult = await _friendRepository.FriendshipExistsAsync(currentUserIdResult.Value.Id, receiverResult.Value.Id, ctoken);
            if (!friendshipExistsResult.IsSuccess)
                return Result.Fail(new Message(500, "An error occurred while checking friendship status."));

            if (friendshipExistsResult.Value)
                return Result.Fail(new Message(409, "A friend request or friendship already exists."));

            var result = await _friendRepository.SendRequestAsync(currentUserIdResult.Value.Id, receiverResult.Value.Id, ctoken);
            if (!result.IsSuccess)
            {
                if (result.Status == RepositoryResultStatus.Conflict)
                    return Result.Fail(new Message(409, "A friend request or friendship already exists."));

                return Result.Fail(new Message(500, "An error occurred while sending the friend request."));
            }

            // Send push notification to the receiver about the new friend request
            var notificationResult = await _pushNotificationService.SendToUserAsync(
            receiverResult.Value.Identifier, "Ny vänförfrågan", $"{currentUserIdResult.Value.NickName} vill bli vän med dig",
            new Dictionary<string, object> { ["type"] = "friend_request" }, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unexpected error occurred while sending a friend request.");
            return Result.Fail(new Message(500, "An unexpected error occurred while sending the friend request."));
        }
    }

    internal record SenderProjection(int Id, string NickName);
    internal record ReceiverProjection(int Id, string Identifier);
}
