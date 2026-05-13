using WebDataContracts.ResponseModels.Friend;

namespace Core.Interfaces.Services;

public interface IFriendService
{
    Task<Result> SendFriendRequestAsync(string currentUserIdentifier, string receiverNickName, CancellationToken ctoken);
    Task<Result> AcceptFriendRequestAsync(string currentUserIdentifier, string requesterIdentifier, CancellationToken ctoken);
    Task<Result<IEnumerable<FriendResponse>>> GetFriendsAsync(string currentUserIdentifier, CancellationToken ctoken);
    Task<Result<IEnumerable<FriendRequestResponse>>> GetIncomingRequestsAsync(string currentUserIdentifier, CancellationToken ctoken);
    Task<Result<IEnumerable<FriendRequestResponse>>> GetOutgoingRequestsAsync(string currentUserIdentifier, CancellationToken ctoken);
    Task<Result> RemoveConnectionAsync(string currentUserIdentifier, string otherIdentifier, CancellationToken ctoken);
}
