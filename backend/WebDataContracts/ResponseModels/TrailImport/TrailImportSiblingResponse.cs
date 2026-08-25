namespace WebDataContracts.ResponseModels.TrailImport;

// One other feature in the session pointing at the same trail as the one being previewed.
public class TrailImportSiblingResponse
{
    public required int ProposalId { get; set; }
    public required string FeatureName { get; set; }
    public required string Decision { get; set; }
    public required string DecidedRole { get; set; }

    public static TrailImportSiblingResponse Create(
        int proposalId,
        string featureName,
        string decision,
        string decidedRole)
    {
        return new TrailImportSiblingResponse
        {
            ProposalId = proposalId,
            FeatureName = featureName,
            Decision = decision,
            DecidedRole = decidedRole
        };
    }
}
