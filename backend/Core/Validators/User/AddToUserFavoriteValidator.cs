// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using FluentValidation;
using WebDataContracts.RequestModels.User;

namespace Core.Validators.User;

public class AddToUserFavoriteValidator : AbstractValidator<AddToUserFavoritesRequest>
{
    public AddToUserFavoriteValidator()
    {
        RuleFor(addToFavoriteRequest => addToFavoriteRequest.TrailIdentifier)
           .NotEmpty().WithMessage("TrailIdentifier is required.")
           .Length(36).WithMessage("TrailIdentifier must be at least 36 characters long.");
    }
}
