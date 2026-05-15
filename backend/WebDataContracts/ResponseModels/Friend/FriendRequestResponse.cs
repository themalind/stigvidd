namespace WebDataContracts.ResponseModels.Friend;

public class FriendRequestResponse
{
    public required string RequesterIdentifier { get; set; }
    public required string RequesterNickName { get; set; }
    public DateTime CreatedAt { get; set; }

    public static FriendRequestResponse Create(string requesterIdentifier, string requesterNickName, DateTime createdAt)
    {
        return new FriendRequestResponse
        {
            RequesterIdentifier = requesterIdentifier,
            RequesterNickName = requesterNickName,
            CreatedAt = createdAt
        };
    }
}
