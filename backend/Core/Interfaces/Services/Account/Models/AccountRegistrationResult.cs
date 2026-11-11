// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.User;

namespace Core.Interfaces.Services.Account.Models;

public record AccountRegistrationResult(
    AccountRegistrationOutcome Outcome,
    UserResponse? User = null,
    Message? Failure = null);
