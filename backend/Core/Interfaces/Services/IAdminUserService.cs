// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

public interface IAdminUserService
{
    /// <summary>Makes the account read-only and records who did it and why.</summary>
    Task<Result> BanAsync(string identifier, string bannedBy, string? reason, CancellationToken ctoken);

    /// <summary>Lets the account write again. The who and why of the lifted ban are kept.</summary>
    Task<Result> UnbanAsync(string identifier, string unbannedBy, CancellationToken ctoken);
}
