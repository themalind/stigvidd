namespace WebDataContracts.RequestModels.HikeShare;

public class ReshareSharedHikeRequest
{
    public required string HikeIdentifier { get; set; }
    public required string ReShareToName { get; set; }
}
