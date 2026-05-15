using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface IFriendRepository
{
    Task<RepositoryResult> SendRequestAsync(int requesterId, int receiverId, CancellationToken ctoken);
    Task<RepositoryResult> AcceptRequestAsync(int requesterId, int receiverId, CancellationToken ctoken);
    Task<RepositoryResult> RejectRequestAsync(int requesterId, int receiverId, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<T>>> GetFriendsAsync<T>(int userId, Expression<Func<User, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<T>>> GetIncomingRequestsAsync<T>(int userId, Expression<Func<FriendRequest, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<T>>> GetOutgoingRequestsAsync<T>(int userId, Expression<Func<FriendRequest, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> RemoveFriendShipOrFriendRequestAsync(int userId, int otherUserId, CancellationToken ctoken);
    Task<RepositoryResult<bool>> FriendshipExistsAsync(int userId, int otherUserId, CancellationToken ctoken);
    Task<RepositoryResult> DeleteAllFriendRequestsByUserIdAsync(int userId, CancellationToken ctoken);
}
