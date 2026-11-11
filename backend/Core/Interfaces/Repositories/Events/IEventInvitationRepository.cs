// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Repositories.Events;

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
