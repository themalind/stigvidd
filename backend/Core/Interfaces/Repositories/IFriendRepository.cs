// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using System.Linq.Expressions;

namespace Core.Interfaces.Repositories;

public interface IFriendRepository
{
    Task<RepositoryResult> SendRequestAsync(int requesterId, int receiverId, CancellationToken ctoken);
    Task<RepositoryResult> AcceptRequestAsync(int requesterId, int receiverId, CancellationToken ctoken);
    Task<RepositoryResult> RejectRequestAsync(int requesterId, int receiverId, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<T>>> GetFriendsAsync<T>(int userId, int[] hiddenUserIds, Expression<Func<User, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<T>>> GetIncomingRequestsAsync<T>(int userId, int[] hiddenUserIds, Expression<Func<FriendRequest, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<T>>> GetOutgoingRequestsAsync<T>(int userId, int[] hiddenUserIds, Expression<Func<FriendRequest, T>> selector, CancellationToken ctoken);
    Task<RepositoryResult> RemoveFriendShipOrFriendRequestAsync(int userId, int otherUserId, CancellationToken ctoken);
    Task<RepositoryResult<bool>> FriendshipExistsAsync(int userId, int otherUserId, CancellationToken ctoken);
    Task<RepositoryResult> SetNoteAsync(int ownerUserId, int friendUserId, string? text, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyDictionary<string, string>>> GetNotesByFriendIdentifierAsync(int ownerUserId, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyDictionary<string, DateTime>>> GetFriendsSinceByIdentifierAsync(int userId, CancellationToken ctoken);
}
