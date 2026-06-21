namespace WebDataContracts.RequestModels.Account;

public class RegisterRequest
{
    public required string Email { get; set; }
    public required string NickName { get; set; }
    public required string Password { get; set; }
}
