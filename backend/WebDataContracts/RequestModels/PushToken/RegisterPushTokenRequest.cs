
namespace WebDataContracts.RequestModels.PushToken;

public class RegisterPushTokenRequest
{
    public required string ExpoToken { get; set; }
    public required string Platform { get; set; }
}
