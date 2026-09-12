// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Infrastructure.Data.Entities;

public class User : BaseEntity
{
    public required string NickName { get; set; }
    public required string Email { get; set; }
    public required string SubjectId { get; set; }

    // When this address was proven. Null means the user registered and never verified.
    // This is the support-visible record only: what actually blocks sign-in is the Keycloak
    // user being disabled, because the app's password grant never passes through this API.
    public DateTime? EmailVerifiedAt { get; set; }

    public ICollection<Trail>? MyWishList { get; set; }
    public ICollection<Trail>? MyFavorites { get; set; }
}


