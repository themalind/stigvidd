// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

public interface IPushNotificationService
{
    /// <summary>Pass fromUserIdentifier when a person triggered this; it is dropped if the recipient blocked them.</summary>
    Task<Result> SendToUserAsync(string userIdentifier, string title, string body, IReadOnlyDictionary<string, object> data, CancellationToken ctoken, string? fromUserIdentifier = null);
    /// <summary>Pass fromUserId when a person triggered this; anyone who blocked them is skipped.</summary> keep-comment: the block filter is invisible at the call site
    Task<Result> SendToUsersAsync(IReadOnlyCollection<int> userIds, string title, string body, IReadOnlyDictionary<string, object> data, CancellationToken ctoken, int? fromUserId = null);
    Task<Result> RegisterTokenAsync(string userIdentifier, string expoToken, string platform, CancellationToken ctoken);
    Task<Result> UnregisterTokenAsync(string userIdentifier, string expoToken, CancellationToken ctoken);
}
