using WebDataContracts.ResponseModels.HikeShare;

namespace Core.Interfaces.Services;

public interface IHikeShareRecipientService
{
    // WithUser = you are the recipient
    Task<Result<IReadOnlyCollection<HikeShareRecipientResponse>>> GetAllHikesSharedWithUserAsync(string identifier, CancellationToken ctoken);
    Task<Result> ReshareSharedHikeAsync(string hikeIdentifier, string userIdentifer, string reShareToName, CancellationToken ctoken);
    Task<Result> RemoveSharedHikeAsync(string hikeIdentifier, string userIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<IncomingHikeShareResponse>>> GetIncomingPendingSharesAsync(string identifier, CancellationToken ctoken);
    Task<Result<HikeShareRecipientResponse>> GetIncomingPendingShareAsync(string userIdentifier, string hikeIdentifier, CancellationToken ctoken);
    Task<Result> AcceptHikeShareAsync(string userIdentifier, string hikeIdentifier, CancellationToken ctoken);
    Task<Result> RejectHikeShareAsync(string userIdentifier, string hikeIdentifier, CancellationToken ctoken);
}
