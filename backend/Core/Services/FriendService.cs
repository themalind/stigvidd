using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using WebDataContracts.ResponseModels.Friend;

namespace Core.Services;

public class FriendService : IFriendService
{
    private readonly IFriendRepository _friendRepository;
    private readonly IUserRepository _userRepository;

    public FriendService(IFriendRepository friendRepository, IUserRepository userRepository)
    {
        _friendRepository = friendRepository;
        _userRepository = userRepository;
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
        {
            return Result.Fail<IEnumerable<FriendRequestResponse>>(new Message(500, "An error occurred while fetching incoming friend requests."));
        }

        return Result.Ok(result.Value);
    }

    public async Task<Result<IEnumerable<FriendRequestResponse>>> GetOutgoingRequestsAsync(string currentUserIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(currentUserIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            if (userIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail<IEnumerable<FriendRequestResponse>>(new Message(404, "User not found."));
            return Result.Fail<IEnumerable<FriendRequestResponse>>(new Message(500, "An error occurred while retrieving the user."));
        }

        var result = await _friendRepository.GetOutgoingRequestsAsync(
            userIdResult.Value,
            u => FriendRequestResponse.Create(u.Receiver!.Identifier, u.Receiver.NickName, u.CreatedAt),
            ctoken);

        if (!result.IsSuccess)
        {
            return Result.Fail<IEnumerable<FriendRequestResponse>>(new Message(500, "An error occurred while fetching outgoing friend requests."));
        }

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
        var currentUserIdResult = await _userRepository.GetUserIdByIdentifierAsync(currentUserIdentifier, ctoken);
        if (!currentUserIdResult.IsSuccess)
        {
            if (currentUserIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Current user not found."));
            return Result.Fail(new Message(500, "An error occurred while retrieving the current user."));
        }

        var receiverIdResult = await _userRepository.GetUserIdByNameAsync(receiverNickName, ctoken);
        if (!receiverIdResult.IsSuccess)
        {
            if (receiverIdResult.Status == RepositoryResultStatus.NotFound)
                return Result.Fail(new Message(404, "Receiver not found."));
            return Result.Fail(new Message(500, "An error occurred while retrieving the receiver."));
        }

        if (currentUserIdResult.Value == receiverIdResult.Value)
            return Result.Fail(new Message(400, "You cannot send a friend request to yourself."));

        var friendshipExistsResult = await _friendRepository.FriendshipExistsAsync(currentUserIdResult.Value, receiverIdResult.Value, ctoken);
        if (!friendshipExistsResult.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while checking friendship status."));

        if (friendshipExistsResult.Value)
            return Result.Fail(new Message(409, "A friend request or friendship already exists."));

        var result = await _friendRepository.SendRequestAsync(currentUserIdResult.Value, receiverIdResult.Value, ctoken);
        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while sending the friend request."));

        return Result.Ok();
    }
}
