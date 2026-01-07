namespace WebDataContracts.RequestModels;

public class CreateUserRequest
{
    public required string Email { get; set; }
    public required string NickName { get; set; }
    public required string FirebaseUid { get; set; }
}
