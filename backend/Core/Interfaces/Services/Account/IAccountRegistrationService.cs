// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Account;

public interface IAccountRegistrationService
{
    Task<AccountRegistrationResult> RegisterAsync(
        string email,
        string nickName,
        string password,
        string requestBaseUrl,
        CancellationToken ctoken);
}
