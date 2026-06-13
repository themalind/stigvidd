namespace Infrastructure.Data.Entities;

public class UserPushToken : BaseEntity
{
    public int UserId { get; set; }
    public required string ExpoToken { get; set; }
    public required string Platform { get; set; }

    public User? User { get; set; }
}
