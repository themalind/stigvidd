// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Repositories;

public record MappableUser(int Id, string NickName, string Email, int HikeCount);

public interface IUserKeycloakMappingRepository
{
    Task<RepositoryResult<IReadOnlyList<UserKeycloakMapping>>> ListMappingsAsync(CancellationToken ctoken);

    Task<RepositoryResult<IReadOnlyList<MappableUser>>> ListUsersAsync(CancellationToken ctoken);

    Task<RepositoryResult> SaveAsync(UserKeycloakMapping mapping, CancellationToken ctoken);

    Task<RepositoryResult> DeleteAsync(int packageUserId, CancellationToken ctoken);
}
