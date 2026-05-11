namespace Infrastructure.Data.Entities;

public class User : SoftDeletableEntity
{
    public required string NickName { get; set; }
    public required string Email { get; set; }
    public required string FirebaseUid { get; set; }

    public ICollection<Trail>? MyWishList { get; set; }
    public ICollection<Trail>? MyFavorites { get; set; }
}


