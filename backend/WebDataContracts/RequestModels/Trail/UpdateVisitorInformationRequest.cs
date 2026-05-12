namespace WebDataContracts.RequestModels.Trail;

public class UpdateVisitorInformationRequest
{
    public string? GettingThere { get; set; }
    public string? PublicTransport { get; set; }
    public string? Parking { get; set; }
    public bool? Illumination { get; set; }
    public string? IlluminationText { get; set; }
    public string? MaintainedBy { get; set; }
    public bool? WinterMaintenance { get; set; }
}
