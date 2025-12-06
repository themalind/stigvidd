using System.Text.Json.Serialization;

namespace Infrastructure.Data.Entities;

public class TrailLink : BaseEntity
{
    public required string Link { get; set; }
    public int TrailId { get; set; }

    public Trail? Trail { get; set; }
}


