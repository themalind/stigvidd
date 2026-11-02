// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace Core.Interfaces.Services;

public interface IEventService
{
    Task<Result<EventResponse>> CreateAsync(string userIdentifier, CreateEventRequest request, CancellationToken ctoken);
    Task<Result<EventPageResponse>> GetFeedAsync(string? userIdentifier, EventFeedQuery query, CancellationToken ctoken);
    Task<Result<EventPageResponse>> GetMineAsync(string userIdentifier, MyEventsQuery query, CancellationToken ctoken);
    Task<Result<EventPreviewResponse>> GetPreviewAsync(string identifier, CancellationToken ctoken);
    Task<Result<EventResponse>> GetAsync(string? userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result<EventResponse>> UpdateAsync(string userIdentifier, string identifier, UpdateEventRequest request, CancellationToken ctoken);
    Task<Result> CancelAsync(string userIdentifier, string identifier, CancellationToken ctoken);
    Task<Result> DeleteAsync(string userIdentifier, string identifier, CancellationToken ctoken);
}
