// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services.Media;
using Microsoft.Extensions.Logging;

namespace Core.Services.Events;

public static class EventImageFiles
{
    // Best effort after commit: a leftover file is only logged. keep-comment: the row is already gone and the request succeeded
    public static async Task DeleteAsync(IWebDavService webDavService, ILogger logger, string url, string eventIdentifier, string operation)
    {
        try
        {
            var result = await webDavService.DeleteFileAsync(url);

            if (result.IsFailure)
                logger.LogError("{Operation} -> WebDAV refused to delete image {Url} of event {EventIdentifier}.", operation, url, eventIdentifier);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "{Operation} -> Failed to delete image {Url} of event {EventIdentifier}.", operation, url, eventIdentifier);
        }
    }
}
