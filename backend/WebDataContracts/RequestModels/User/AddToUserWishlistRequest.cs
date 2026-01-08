namespace WebDataContracts.RequestModels.User;

public class AddToUserWishlistRequest
{
    public required string UserIdentifier { get; set; }
    public required string TrailIdentifier { get; set; }
}
