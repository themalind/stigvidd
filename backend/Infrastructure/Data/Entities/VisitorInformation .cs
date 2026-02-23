namespace Infrastructure.Data.Entities;

public class VisitorInformation : BaseEntity
{
    public string GettingThere { get; set; } = string.Empty;
    public string PublicTransport { get; set; } = string.Empty;
    public string Parking { get; set; } = string.Empty;
    public bool Illumination { get; set; }
    public string IlluminationText { get; set; } = string.Empty;
    public string MaintainedBy { get; set; } = string.Empty;
    public bool WinterMaintenance { get; set; }
}
