using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
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
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger _logger;


    public ExpoPushService(
        IUserPushTokenRepository userPushTokenRepository,
        IUserRepository userRepository,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<ExpoPushService> logger)
    {
        _userPushTokenRepository = userPushTokenRepository;
        _userRepository = userRepository;
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

    public async Task<Result> SendToUserAsync(string userIdentifier, string title, string body, IReadOnlyDictionary<string, object> data, CancellationToken ctoken)
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

            // Step 2: Get Expo push tokens for the user
            var tokensResult = await _userPushTokenRepository.GetTokensForUserAsync(userResult.Value, ctoken);
            if (!tokensResult.IsSuccess)
            {
                if(tokensResult.Status == RepositoryResultStatus.Error)
                    _logger.LogError("ExpoPushService: SendToUserAsync -> Failed to get push tokens for user {UserId}. Status: {Status}", userResult.Value, tokensResult.Status);
                    return Result.Fail(new Message(500,"Failed to get push tokens"));
            }

            // Step 3: Build one message per registered device. One token = one device; one friend request
            // triggers a single SendToUserAsync call that fans out to all of the recipient's devices (usually one).
            var expoPushMsg = tokensResult.Value.Select(t => new ExpoPushMessage(
                To: t.ExpoToken,
                Title: title,
                Body: body,
                Data: data
            ))
            .ToList()
            .Chunk(100); // Expo recommends batching messages in chunks of 100

            // Step 4: Send each batch of messages to Expo's push endpoint
            foreach (var batch in expoPushMsg)
            {
                // Post to Expo's push API
                var response = await _httpClient.PostAsJsonAsync(PushEndpoint, batch, _jsonOptions, ctoken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("ExpoPushService: SendToUserAsync -> Failed to send push notifications for user {UserId}. Status Code: {StatusCode}", userResult.Value, response.StatusCode);
                    continue;
                }

                var ticketsResponse = await response.Content.ReadFromJsonAsync<ExpoTicketsResponse>(cancellationToken: ctoken);
                if (ticketsResponse == null)
                {
                    _logger.LogError("ExpoPushService: SendToUserAsync -> Failed to parse Expo tickets response for user {UserId}. Response content was null.", userResult.Value);
                    continue;
                }

                // Step 5: Correlate each ticket back to its message by index (Expo preserves order).
                // This lets us know which token caused a failure so we can act on it.
                // batch.Zip pairs each sent message with its ticket by position — ticket.Id is Expo's
                // receipt ID, not the token, so the zip is the only way to know which token failed.
                foreach (var (message, ticket) in batch.Zip(ticketsResponse.Data))
                {
                    if (ticket.Status == "ok") continue;

                    if (ticket.Details?.Error == "DeviceNotRegistered")
                    {
                        // App was uninstalled or the token was revoked — remove it so future sends skip it.
                        await _userPushTokenRepository.DeleteByTokenAsync(message.To, ctoken);
                        _logger.LogInformation("ExpoPushService: Removed stale push token {Token}", message.To);
                    }
                    else
                    {
                        // Other errors (InvalidCredentials, MessageTooBig, etc.) don't need token cleanup,
                        // but do need attention — log at warning so they surface without failing the caller.
                        _logger.LogWarning("ExpoPushService: Push notification failed for token {Token}. Error: {Error} — {Message}",
                            message.To, ticket.Details?.Error, ticket.Message);
                    }
                }
            }

            return Result.Ok();
        }
        catch (Exception ex) 
        {
            _logger.LogError(ex, "ExpoPushService: SendToUserAsync -> An unexpected error occurred while sending push notifications to user {Identifier}.", userIdentifier);
            return Result.Fail(new Message(500, "An error occurred while sending push notifications."));
        }

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
            _logger.LogWarning("ExpoPushService: UnregisterTokenAsync -> Attempted to unregister token {Token} for user {UserId}, but it was not found.", expoToken, userIdResult.Value);
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