namespace WebDataContracts.ResponseModels.Trail;

public class VisitorInformationResponse
{
    public required string  Identifier { get; set; }
    public string GettingThere { get; set; } = string.Empty;
    public string PublicTransport { get; set; } = string.Empty;
    public string Parking { get; set; } = string.Empty;

    public static VisitorInformationResponse Create(string identifier, string gettingThere, string publicTransport, string parking)
    {
        return new VisitorInformationResponse
        {
            Identifier = identifier,
            GettingThere = gettingThere,
            PublicTransport = publicTransport,
            Parking = parking
        };
    }
}
