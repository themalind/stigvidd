// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.AspNetCore.Http;
using WebDataContracts.ResponseModels.Event;

namespace Core.Interfaces.Services.Events;

public interface IEventImageService
{
    Task<Result<EventImageResponse>> SetImageAsync(string userIdentifier, string identifier, IFormFile image, double? focusY, CancellationToken ctoken);
    Task<Result> DeleteImageAsync(string userIdentifier, string identifier, CancellationToken ctoken);
}
