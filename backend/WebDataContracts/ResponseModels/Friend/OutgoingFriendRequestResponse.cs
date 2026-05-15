namespace WebDataContracts.ResponseModels.Friend;

public class OutgoingFriendRequestResponse
{
    public required string ReceiverIdentifier { get; set; }
    public required string ReceiverNickName { get; set; }
    public DateTime CreatedAt { get; set; }

    public static OutgoingFriendRequestResponse Create(string receiverIdentifier, string receiverNickName, DateTime createdAt)
    {
        return new OutgoingFriendRequestResponse
        {
            ReceiverIdentifier = receiverIdentifier,
            ReceiverNickName = receiverNickName,
            CreatedAt = createdAt
        };
    }
}