namespace WebDataContracts.ResponseModels.Friend;

public class SearchFriendResultResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }

    public static SearchFriendResultResponse Create(string identifier, string nickName)
    {
        return new SearchFriendResultResponse
        {
            Identifier = identifier,
            NickName = nickName
        };
    }
}
