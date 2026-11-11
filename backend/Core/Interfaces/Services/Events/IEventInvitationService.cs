// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace Core.Interfaces.Services.Events;

public interface IEventInvitationService
{
    Task<Result> InviteAsync(string userIdentifier, string identifier, EventInviteRequest request, CancellationToken ctoken);
    Task<Result<IReadOnlyList<EventInvitationResponse>>> GetPendingAsync(string userIdentifier, CancellationToken ctoken);
    Task<Result> AcceptAsync(string userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result> DeclineAsync(string userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result> RevokeAsync(string userIdentifier, string identifier, string inviteeIdentifier, CancellationToken ctoken);
}
