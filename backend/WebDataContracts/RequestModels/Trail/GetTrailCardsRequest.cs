namespace WebDataContracts.RequestModels.Trail;

public class GetTrailCardsRequest
{
    public required IReadOnlyCollection<string> Identifiers { get; set; }
}
