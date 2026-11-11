// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;

namespace Core.Interfaces.Repositories.Events;

public interface IEventParticipantRepository
{
    // Conflict means no spot was taken: the event is full, or no longer open to joining. keep-comment: the caller works out which
    Task<RepositoryResult> JoinAsync(int eventId, int userId, DateTime now, CancellationToken ctoken);
    // As JoinAsync, but a reported event still takes the invitee; Conflict also when the invitation is no longer pending. keep-comment: how accept differs from join
    Task<RepositoryResult> AcceptInvitationAsync(int eventId, int userId, DateTime now, CancellationToken ctoken);
    Task<RepositoryResult> MarkInterestedAsync(int eventId, int userId, CancellationToken ctoken);
    Task<RepositoryResult> UnmarkInterestedAsync(int eventId, int userId, CancellationToken ctoken);
    Task<RepositoryResult<LeftEvent>> LeaveAsync(int eventId, int userId, CancellationToken ctoken);
    Task<RepositoryResult<EventParticipantRow>> GetAsync(int eventId, string userIdentifier, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyList<EventParticipantRow>>> GetJoinedAsync(int eventId, CancellationToken ctoken);
    // Conflict means the target's role, read under the event lock, is not one the caller may remove. keep-comment: the role may have changed since the service checked it
    Task<RepositoryResult> RemoveAsync(int eventId, int userId, IReadOnlyCollection<EventParticipantRole> removableRoles, CancellationToken ctoken);
    // Conflict means the target has become the organizer since the service checked. keep-comment: a hand-over may have promoted them
    Task<RepositoryResult> SetRoleAsync(int eventId, int userId, EventParticipantRole role, CancellationToken ctoken);
    Task<RepositoryResult> SetMutedAsync(int eventId, int userId, bool muted, CancellationToken ctoken);
}
