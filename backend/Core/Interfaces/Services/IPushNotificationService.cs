namespace Core.Interfaces.Services;

public interface IPushNotificationService
{
    Task<Result> SendToUserAsync(string userIdentifier, string title, string body, IReadOnlyDictionary<string, object> data, CancellationToken ctoken);
    Task<Result> RegisterTokenAsync(string userIdentifier, string expoToken, string platform, CancellationToken ctoken);
    Task<Result> UnregisterTokenAsync(string userIdentifier, string expoToken, CancellationToken ctoken);
}
