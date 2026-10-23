// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Core.Services;

public class ExpoPushService : IPushNotificationService
{
    private const string PushEndpoint = "--/api/v2/push/send";
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly IUserPushTokenRepository _userPushTokenRepository;
    private readonly IUserRepository _userRepository;
    private readonly IUserBlockRepository _userBlockRepository;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger _logger;


    public ExpoPushService(
        IUserPushTokenRepository userPushTokenRepository,
        IUserRepository userRepository,
        IUserBlockRepository userBlockRepository,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<ExpoPushService> logger)
    {
        _userPushTokenRepository = userPushTokenRepository;
        _userRepository = userRepository;
        _userBlockRepository = userBlockRepository;
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        // If an Expo access token is configured, attach it once on the shared client.
        // Without it requests still work but are rate-limited more aggressively by Expo.
        var accessToken = configuration["ExpoPush:AccessToken"];
        if (accessToken is not null)
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    }

    public async Task<Result> RegisterTokenAsync(string userIdentifier, string expoToken, string platform, CancellationToken ctoken)
    {
        // Step 1: Get user ID from identifier
        var userResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);
        if (!userResult.IsSuccess)
        {
            _logger.LogError("ExpoPushService: RegisterTokenAsync -> Failed to get user ID for identifier {Identifier}. Status: {Status}", userIdentifier, userResult.Status);
            if (userResult.Status == RepositoryResultStatus.Error)
                return Result.Fail(new Message(500, "An error occurred while fetching the user."));

            return Result.Fail(new Message(404, "User not found"));
        }

        // Step 2: Upsert the push token for the user
        var upsertResult = await _userPushTokenRepository.UpsertAsync(userResult.Value, expoToken, platform, ctoken);
        if (!upsertResult.IsSuccess)
        {
            _logger.LogError("ExpoPushService: RegisterTokenAsync -> Failed to register push token for user {UserId}. Status: {Status}", userResult.Value, upsertResult.Status);
            return Result.Fail(new Message(500, "An error occurred while registering the push token."));
        }

        return Result.Ok();
    }

    public async Task<Result> SendToUserAsync(string userIdentifier, string title, string body, IReadOnlyDictionary<string, object> data, CancellationToken ctoken, string? fromUserIdentifier = null)
    {
        try
        {
            // Step 1: Get user ID from identifier
            var userResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);
            if (!userResult.IsSuccess)
            {
                _logger.LogError("ExpoPushService: SendToUserAsync -> Failed to get user ID for identifier {Identifier}. Status: {Status}", userIdentifier, userResult.Status);
                if (userResult.Status == RepositoryResultStatus.Error)
                    return Result.Fail(new Message(500, "An error occurred while fetching the user."));

                return Result.Fail(new Message(404, "User not found"));
            }

            if (await RecipientHasBlockedSenderAsync(userResult.Value, fromUserIdentifier, ctoken))
                return Result.Ok();

            // Step 2: Get Expo push tokens for the user
            var tokensResult = await _userPushTokenRepository.GetTokensForUserAsync(userResult.Value, ctoken);
            if (!tokensResult.IsSuccess)
            {
                if(tokensResult.Status == RepositoryResultStatus.Error)
                    _logger.LogError("ExpoPushService: SendToUserAsync -> Failed to get push tokens for user {UserId}. Status: {Status}", userResult.Value, tokensResult.Status);
                    return Result.Fail(new Message(500,"Failed to get push tokens"));
            }

            await SendToTokensAsync(tokensResult.Value.ToList(), title, body, data, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExpoPushService: SendToUserAsync -> An unexpected error occurred while sending push notifications to user {Identifier}.", userIdentifier);
            return Result.Fail(new Message(500, "An error occurred while sending push notifications."));
        }
    }

    public async Task<Result> SendToUsersAsync(IReadOnlyCollection<int> userIds, string title, string body, IReadOnlyDictionary<string, object> data, CancellationToken ctoken, int? fromUserId = null)
    {
        try
        {
            var recipients = userIds.Distinct().ToList();
            var requested = recipients.Count;

            // Fails open: a failed block lookup still sends, like RecipientHasBlockedSenderAsync. keep-comment: matches the single-user path on purpose
            if (fromUserId is int senderId && recipients.Count > 0)
            {
                var blockersResult = await _userBlockRepository.GetUsersWhoBlockedAsync(senderId, recipients, ctoken);
                if (blockersResult.IsSuccess)
                    recipients = recipients.Except(blockersResult.Value).ToList();
            }

            if (recipients.Count == 0)
                return Result.Ok();

            var tokensResult = await _userPushTokenRepository.GetTokensForUsersAsync(recipients, ctoken);
            if (!tokensResult.IsSuccess)
            {
                _logger.LogError("ExpoPushService: SendToUsersAsync -> Failed to get push tokens for {Count} users. Status: {Status}", recipients.Count, tokensResult.Status);
                return Result.Fail(new Message(500, "Failed to get push tokens"));
            }

            _logger.LogDebug(
                "ExpoPushService: SendToUsersAsync -> {Recipients} recipients, {SkippedBlocked} skipped as blockers, {Tokens} devices",
                recipients.Count, requested - recipients.Count, tokensResult.Value.Count);

            await SendToTokensAsync(tokensResult.Value, title, body, data, ctoken);

            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExpoPushService: SendToUsersAsync -> An unexpected error occurred while sending push notifications to {Count} users.", userIds.Count);
            return Result.Fail(new Message(500, "An error occurred while sending push notifications."));
        }
    }

    private async Task SendToTokensAsync(IReadOnlyCollection<UserPushToken> tokens, string title, string body, IReadOnlyDictionary<string, object> data, CancellationToken ctoken)
    {
        var userIdByToken = tokens.GroupBy(t => t.ExpoToken).ToDictionary(g => g.Key, g => g.First().UserId);
        var expoPushMsg = userIdByToken.Keys.Select(token => new ExpoPushMessage(
            To: token,
            Title: title,
            Body: body,
            Data: data
        ))
        .ToList()
        .Chunk(100); // Expo recommends batching messages in chunks of 100

        foreach (var batch in expoPushMsg)
        {
            var response = await _httpClient.PostAsJsonAsync(PushEndpoint, batch, _jsonOptions, ctoken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("ExpoPushService: Failed to send {Count} push notifications. Status Code: {StatusCode}", batch.Length, response.StatusCode);
                continue;
            }

            var ticketsResponse = await response.Content.ReadFromJsonAsync<ExpoTicketsResponse>(cancellationToken: ctoken);
            if (ticketsResponse == null)
            {
                _logger.LogError("ExpoPushService: Failed to parse Expo tickets response for {Count} push notifications. Response content was null.", batch.Length);
                continue;
            }

            // Correlate each ticket back to its message by index (Expo preserves order). keep-comment: ticket order is Expo's contract
            // This lets us know which token caused a failure so we can act on it.
            // batch.Zip pairs each sent message with its ticket by position — ticket.Id is Expo's
            // receipt ID, not the token, so the zip is the only way to know which token failed.
            foreach (var (message, ticket) in batch.Zip(ticketsResponse.Data))
            {
                if (ticket.Status == "ok") continue;

                var userId = userIdByToken[message.To];
                if (ticket.Details?.Error == "DeviceNotRegistered")
                {
                    // App was uninstalled or the token was revoked — remove it so future sends skip it.
                    await _userPushTokenRepository.DeleteByTokenAsync(message.To, ctoken);
                    _logger.LogInformation("ExpoPushService: Removed a stale push token for user {UserId}", userId);
                }
                else
                {
                    // Other errors (InvalidCredentials, MessageTooBig, etc.) don't need token cleanup,
                    // but do need attention — log at warning so they surface without failing the caller.
                    _logger.LogWarning("ExpoPushService: Push notification failed for a device of user {UserId}. Error: {Error} — {Message}",
                        userId, ticket.Details?.Error, ticket.Message);
                }
            }
        }
    }

    // Fails open: a failed lookup still sends.
    private async Task<bool> RecipientHasBlockedSenderAsync(int recipientUserId, string? fromUserIdentifier, CancellationToken ctoken)
    {
        if (string.IsNullOrWhiteSpace(fromUserIdentifier))
            return false;

        var senderIdResult = await _userRepository.GetUserIdByIdentifierAsync(fromUserIdentifier, ctoken);

        if (!senderIdResult.IsSuccess)
            return false;

        var blockedResult = await _userBlockRepository.HasBlockedAsync(recipientUserId, senderIdResult.Value, ctoken);

        return blockedResult.IsSuccess && blockedResult.Value;
    }

    public async Task<Result> UnregisterTokenAsync(string userIdentifier, string expoToken, CancellationToken ctoken)
    {
        // Step 1: Get user ID from identifier
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);
        if (!userIdResult.IsSuccess)
        {
            _logger.LogError("ExpoPushService: UnregisterTokenAsync -> Failed to get user ID for identifier {Identifier}. Status: {Status}", userIdentifier, userIdResult.Status);
            if (userIdResult.Status == RepositoryResultStatus.Error)
                return Result.Fail(new Message(500, "An error occurred while fetching the user."));

            return Result.Fail(new Message(404, "User not found"));
        }

        // Verify that the token exists for the user before attempting deletion, to provide accurate feedback.
        var tokensResult = await _userPushTokenRepository.GetByTokenAndUserAsync(expoToken, userIdResult.Value, ctoken);
        if (!tokensResult.IsSuccess)
        {
            if (tokensResult.Status == RepositoryResultStatus.Error)
                _logger.LogError("ExpoPushService: UnregisterTokenAsync -> Failed to get push token for user {UserId}. Status: {Status}", userIdResult.Value, tokensResult.Status);
                return Result.Fail(new Message(500, "Failed to get push token"));
        }

        if (tokensResult.Value == null)
        {
            _logger.LogWarning("ExpoPushService: UnregisterTokenAsync -> Attempted to unregister a push token for user {UserId}, but it was not found.", userIdResult.Value);
            return Result.Fail(new Message(404, "Push token not found for user."));
        };

        // Step 2: Delete the push token for the user
        var deleteResult = await _userPushTokenRepository.DeleteByTokenAsync(expoToken, ctoken);
        if (!deleteResult.IsSuccess)
        {
            _logger.LogError("ExpoPushService: UnregisterTokenAsync -> Failed to unregister push token for user {UserId}. Status: {Status}", userIdResult.Value, deleteResult.Status);
            return Result.Fail(new Message(500, "An error occurred while unregistering the push token."));
        }

        return Result.Ok();
    }

    private record ExpoPushMessage(
    string To, string Title, string Body,
    IReadOnlyDictionary<string, object> Data,
    string Sound = "default",
    string ChannelId = "default");   // ignored on iOS, routes Android to the named channel

    private record ExpoTicket(string Status, string? Id, string? Message,
        ExpoTicketDetails? Details);
    private record ExpoTicketDetails(string? Error);
    private record ExpoTicketsResponse(IReadOnlyList<ExpoTicket> Data);
}

// https://docs.expo.dev/push-notifications/sending-notifications/