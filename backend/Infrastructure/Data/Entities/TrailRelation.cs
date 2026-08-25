using Infrastructure.Enums;

namespace Infrastructure.Data.Entities;

// Ties two trails together. A symmetric relation is stored as one row and read from
// both columns.
public class TrailRelation : BaseEntity
{
    public int FromTrailId { get; set; }
    public Trail? FromTrail { get; set; }

    public int ToTrailId { get; set; }
    public Trail? ToTrail { get; set; }

    public TrailRelationType Type { get; set; }

    // Stage number within the parent trail. Null for every type but PartOf.
    public int? Sequence { get; set; }
}
