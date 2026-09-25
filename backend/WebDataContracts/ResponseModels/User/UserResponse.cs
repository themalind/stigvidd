// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.User;

public class UserResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }
    public required string Email { get; set; }

    // Set means the account is read-only; the app hides what it may no longer do.
    public DateTime? BannedAt { get; set; }

    public ICollection<UserWishlistTrailResponse>? MyWishList { get; set; }
    public ICollection<UserFavoritesTrailResponse>? MyFavorites { get; set; }

    public static UserResponse Create(
        string identifier,
        string nickName,
        string email,
        ICollection<UserWishlistTrailResponse>? myWishList = null,
        ICollection<UserFavoritesTrailResponse>? myFavorites = null,
        DateTime? bannedAt = null)
    {
        return new UserResponse
        {
            Identifier = identifier,
            NickName = nickName,
            Email = email,
            BannedAt = bannedAt,
            MyWishList = myWishList?.ToList(),
            MyFavorites = myFavorites?.ToList(),
        };
    }
}
