// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using WebDataContracts.ResponseModels.Review;
using WebDataContracts.ResponseModels.Trail;
using WebDataContracts.ResponseModels.User;

namespace Core.Factories;

public class UserResponseFactory
{
    public string PresentableBaseUrl { get; }

    public UserResponseFactory(IConfiguration configuration)
    {
        PresentableBaseUrl = configuration["PresentableBaseUrl"] ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

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
                    wish.City,
                    wish.Classification,
                    wish.Accessibility,
                    // Runs in memory over materialised entities, so GeoPath must be
                    // null-checked for real. The '!' used in UserService is safe there
                    // only because those lambdas are expression trees translated to SQL.
                    (decimal?)wish.GeoPath?.StartPoint.Coordinate.Y,
                    (decimal?)wish.GeoPath?.StartPoint.Coordinate.X,
                    wish.Reviews?.Select(r =>
                        RatingResponse.Create(
                            r.Identifier,
                            r.Rating)).ToList(),
                    wish.TrailImages?.Select(ti =>
                        TrailImageResponse.Create(
                            PresentableBaseUrl,
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
                    favorite.City,
                    favorite.Classification,
                    favorite.Accessibility,
                    (decimal?)favorite.GeoPath?.StartPoint.Coordinate.Y,
                    (decimal?)favorite.GeoPath?.StartPoint.Coordinate.X,
                    favorite.Reviews?.Select(review =>
                        RatingResponse.Create(
                            review.Identifier,
                            review.Rating)).ToList(),
                    favorite.TrailImages?.Select(trailImage =>
                        TrailImageResponse.Create(
                            PresentableBaseUrl,
                            trailImage.Identifier,
                            trailImage.ImageUrl)
                    ).ToList()
                )
            ).ToList());
    }
}

