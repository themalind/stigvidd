using Infrastructure.Enums;

namespace Core.Common;

// Another feature in the same session aiming at the same trail. Two of them linked as
// Segment would lay the same ground into the trail's route twice, so the review view has
// to say so while there is still a decision to make.
public sealed record ProposalSibling(
    int ProposalId,
    string FeatureName,
    ProposalDecision Decision,
    TrailSourceLinkRole DecidedRole);
