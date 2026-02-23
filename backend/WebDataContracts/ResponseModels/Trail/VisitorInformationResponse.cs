namespace WebDataContracts.ResponseModels.Trail;

public class VisitorInformationResponse
{
    public required string  Identifier { get; set; }
    public string GettingThere { get; set; } = string.Empty;
    public string PublicTransport { get; set; } = string.Empty;
    public string Parking { get; set; } = string.Empty;
    public bool Illumination { get; set; }
    public string IlluminationText { get; set; } = string.Empty;
    public string MaintainedBy { get; set; } = string.Empty;
    public bool WinterMaintenacnce { get; set; }

    public static VisitorInformationResponse Create(
        string identifier,
        string gettingThere,
        string publicTransport,
        string parking,
        bool illumination,
        string illuminationText,
        string maintainedBy,
        bool winterMaintenance)
    {
        return new VisitorInformationResponse
        {
            Identifier = identifier,
            GettingThere = gettingThere,
            PublicTransport = publicTransport,
            Parking = parking,
            Illumination = illumination,
            IlluminationText = illuminationText,
            MaintainedBy = maintainedBy,
            WinterMaintenacnce = winterMaintenance
        };
    }
}
