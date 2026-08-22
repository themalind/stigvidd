namespace Core.Common;

// What the reviewer typed over the source before saving a decision: a shorter name for a
// trail CreateNew will create, and the length to write when the stated figure and the
// measured one disagree. Null in either field leaves that value to the source.
public sealed record ProposalOverrides(string? Name, decimal? LengthKm);
