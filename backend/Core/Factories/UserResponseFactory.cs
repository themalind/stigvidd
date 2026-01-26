using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Factories;

public class UserResponseFactory
{
    public UserResponse Create(User user)
    {
        return UserResponse.Create(
            user.Identifier,
            user.NickName,
            user.Email,           

            user.MyWishList?.Select(wish =>
                UserWishlistTrailResponse.Create(
                    wish.Identifier,
                    wish.Name,
                    wish.TrailLength,
                    wish.Description,
                    wish.Reviews?.Select(r =>
                        RatingResponse.Create(
                            r.Identifier,
                            r.Grade)).ToList(),
                    wish.TrailImages?.Select(ti =>
                        TrailImageResponse.Create(
                            ti.Identifier,
                            ti.ImageUrl)
                    ).ToList()
                )
            ).ToList(),

            user.MyFavorites?.Select(favorite =>
                UserFavoritesTrailResponse.Create(
                    favorite.Identifier,
                    favorite.Name,
                    favorite.TrailLength,
                    favorite.Description,
                    favorite.Reviews?.Select(review =>
                        RatingResponse.Create(
                            review.Identifier,
                            review.Grade)).ToList(),
                    favorite.TrailImages?.Select(trailImage =>
                        TrailImageResponse.Create(
                            trailImage.Identifier,
                            trailImage.ImageUrl)
                    ).ToList()
                )
            ).ToList());
    }
}

