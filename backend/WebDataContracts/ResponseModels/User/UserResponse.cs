using WebDataContracts.ResponseModels.Trail;

namespace WebDataContracts.ResponseModels.User;

public class UserResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }
    public required string Email { get; set; }

    public ICollection<UserWishlistTrailCollectionResponse>? MyWishList { get; set; }
    public ICollection<UserFavoritesTrailCollectionResponse>? MyFavorites { get; set; }

    public static UserResponse Create(
        string identifier,
        string nickName,
        string email,
        ICollection<UserWishlistTrailCollectionResponse>? myWishList,
        ICollection<UserFavoritesTrailCollectionResponse>? myFavorites)
    {
        return new UserResponse
        {
            Identifier = identifier,
            NickName = nickName,
            Email = email,
            MyWishList = myWishList?.ToList(),
            MyFavorites = myFavorites?.ToList(),
        };
    }
}
