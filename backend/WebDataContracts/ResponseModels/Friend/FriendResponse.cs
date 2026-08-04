namespace WebDataContracts.ResponseModels.Friend;

public class FriendResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }
    public required string Email { get; set; }

    public static FriendResponse Create(string identifier, string nickName, string email)
    {
        return new FriendResponse
        {
            Identifier = identifier,
            NickName = nickName,
            Email = email
        };
    }
}
