using System.ComponentModel.DataAnnotations;

namespace WebDataContracts.RequestModels.TrailImport;

// What the reviewer chose for one feature. The trail is named by its identifier, the same
// way every other endpoint names one; it is only read for Relink, since Accept takes the
// suggested trail and the other decisions link to nothing.
public class DecideProposalRequest
{
    [Required]
    public required string Decision { get; set; }

    public string? TrailIdentifier { get; set; }

    // Segment when the feature is part of a trail's route, Duplicate when it repeats one.
    public string? Role { get; set; }

    [MaxLength(2000)]
    public string? Note { get; set; }

    // The name a trail created from this feature gets. The view starts it at the source's
    // name, which is long enough to break the app's list views, so the reviewer shortens
    // it here. Rejected for every other decision: an existing name is ours to keep.
    [MaxLength(200)]
    public string? Name { get; set; }

    // The length in kilometres, in the trail's own unit, for when the stated figure and
    // the measured one disagree. Left out, the trail keeps the length it already has.
    [Range(0.01, 1000)]
    public decimal? LengthKm { get; set; }
}
