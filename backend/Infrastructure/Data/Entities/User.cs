namespace Infrastructure.Data.Entities;

public class User
{
    public int Id { get; set; }
    public required string NickName { get; set; }
    public required string Email { get; set; }

    public ICollection<Trail>? MyFavorites { get; set; }
    public ICollection<Trail>? MyWishList { get; set; }
    public Statistics? MyStatistics { get; set; }
}


