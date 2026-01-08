namespace WebDataContracts.RequestModels.User;

public class AddToUserFavoritesRequest
{
    public required string UserIdentifier { get; set; }
    public required string TrailIdentifier { get; set; }
}
