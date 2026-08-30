// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public interface IUserPushTokenRepository
{
    Task<RepositoryResult> UpsertAsync(int userId, string expoToken, string platform, CancellationToken ctoken);
    Task<RepositoryResult<IEnumerable<UserPushToken>>> GetTokensForUserAsync(int userId, CancellationToken ctoken);
    Task<RepositoryResult<UserPushToken?>> GetByTokenAndUserAsync(string expoToken, int userId, CancellationToken ctoken);
    Task<RepositoryResult> DeleteByTokenAsync(string expoToken, CancellationToken ctoken);
}
