namespace WebDataContracts.ResponseModels.User;

public class UserNameResponse
{
    public string? Nickname { get; set; }
    public bool Exists { get; set; }

    public static UserNameResponse Create(string? Nickname, bool Exists)
    {
        return new UserNameResponse
        {
            Nickname = Nickname,
            Exists = Exists
        };
    }


}
