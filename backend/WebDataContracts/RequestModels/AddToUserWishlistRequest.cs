namespace WebDataContracts.RequestModels;

public class AddToUserWishlistRequest
{
    public required string UserIdentifier { get; set; }
    public required string TrailIdentifier { get; set; }
}
