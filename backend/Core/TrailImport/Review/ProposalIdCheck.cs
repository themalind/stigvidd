namespace Core.TrailImport.Review;

// What a batch of proposal ids turned out to be. Found below the requested count means
// ids from another session slipped in; WithoutSuggestion is what stops Accept from
// approving a match that was never made.
public sealed record ProposalIdCheck(int Found, int WithoutSuggestion);
