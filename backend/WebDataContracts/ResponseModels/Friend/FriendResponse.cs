namespace WebDataContracts.ResponseModels.Friend;

public class FriendResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }

    public static FriendResponse Create(string identifier, string nickName)
    {
        return new FriendResponse
        {
            Identifier = identifier,
            NickName = nickName
        };
    }
}
