// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Event;
using WebDataContracts.ResponseModels.Event;

namespace Core.Interfaces.Services.Events;

public interface IEventBoardService
{
    Task<Result<EventBoardResponse>> GetBoardAsync(string userIdentifier, string identifier, EventBoardQuery query, CancellationToken ctoken);
    Task<Result<EventPostResponse>> CreatePostAsync(string userIdentifier, string identifier, EventPostRequest request, CancellationToken ctoken);
    Task<Result> MarkReadAsync(string userIdentifier, string identifier, EventPostsReadRequest request, CancellationToken ctoken);
    Task<Result<EventPostResponse>> UpdatePostAsync(string userIdentifier, string postIdentifier, EventPostRequest request, CancellationToken ctoken);
    Task<Result> DeletePostAsync(string userIdentifier, string postIdentifier, CancellationToken ctoken);
    Task<Result> SetPinnedAsync(string userIdentifier, string postIdentifier, EventPostPinRequest request, CancellationToken ctoken);
}
