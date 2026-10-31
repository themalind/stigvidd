// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories;

public sealed record InviteeCandidate(int UserId, string NickName);

// NotifyUserIds leaves out invitees who blocked the inviter: they get no row and no push. keep-comment: the silent skip a caller must not undo
public sealed record InviteOutcome(string InviterNickName, IReadOnlyList<int> NotifyUserIds);

public sealed record PendingInvitation(EventCard Event, int? InvitedByUserId, string? InvitedByNickName, DateTime InvitedAt);

public sealed record EventInvitee(int UserId, string UserIdentifier, string NickName, int? InvitedByUserId, string? InvitedByNickName, DateTime InvitedAt);

public sealed record InvitationRow(int InvitedUserId, int? InvitedByUserId);

public interface IEventInvitationRepository
{
    Task<RepositoryResult<IReadOnlyList<InviteeCandidate>>> FindByNickNamesAsync(IReadOnlyCollection<string> nickNames, CancellationToken ctoken);
    Task<RepositoryResult<int>> CountInvitedSinceAsync(int inviterUserId, DateTime since, CancellationToken ctoken);

    // Conflict means more new invitations than maxNew, and nothing was saved; NotFound means the event stopped taking invitations since the service checked. keep-comment: how the caller tells the two apart
    Task<RepositoryResult<InviteOutcome>> InviteAsync(int eventId, int inviterUserId, IReadOnlyCollection<int> userIds, int maxNew, DateTime now, TimeSpan logWindow, CancellationToken ctoken);

    Task<RepositoryResult<IReadOnlyList<PendingInvitation>>> GetPendingForUserAsync(int userId, int[] hiddenUserIds, DateTime now, int limit, CancellationToken ctoken);
    Task<RepositoryResult<IReadOnlyList<EventInvitee>>> GetPendingForEventAsync(int eventId, CancellationToken ctoken);
    Task<RepositoryResult<InvitationRow>> GetPendingAsync(int eventId, string invitedUserIdentifier, CancellationToken ctoken);

    // Both succeed when there is no pending invitation left to change. keep-comment: undo actions are idempotent
    Task<RepositoryResult> DeclineAsync(int eventId, int userId, CancellationToken ctoken);
    Task<RepositoryResult> RevokeAsync(int eventId, int invitedUserId, CancellationToken ctoken);
}
