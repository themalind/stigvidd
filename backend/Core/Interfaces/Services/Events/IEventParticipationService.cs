// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace Core.Interfaces.Services.Events;

public interface IEventParticipationService
{
    Task<Result> JoinAsync(string userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result> MarkInterestedAsync(string userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result> UnmarkInterestedAsync(string userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result> LeaveAsync(string userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result<EventParticipantsResponse>> GetParticipantsAsync(string userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result> RemoveParticipantAsync(string userIdentifier, string identifier, string participantIdentifier, CancellationToken ctoken);
    Task<Result> SetRoleAsync(string userIdentifier, string identifier, string participantIdentifier, EventRoleRequest request, CancellationToken ctoken);
    Task<Result> SetMutedAsync(string userIdentifier, string identifier, EventMuteRequest request, CancellationToken ctoken);
}
