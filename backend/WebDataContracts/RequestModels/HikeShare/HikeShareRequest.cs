namespace WebDataContracts.RequestModels.HikeShare;

public class HikeShareRequest
{
    public required string HikeIdentifier { get; set; }
    public required string SharedWithName { get; set; }
}
