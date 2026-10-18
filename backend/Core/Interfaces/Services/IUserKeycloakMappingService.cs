// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.UserMapping;
using WebDataContracts.ResponseModels.UserMapping;

namespace Core.Interfaces.Services;

public interface IUserKeycloakMappingService
{
    Task<Result<UserMappingsResponse>> GetAsync(CancellationToken ctoken);

    Task<Result<IReadOnlyList<KeycloakUserResponse>>> SearchKeycloakUsersAsync(string? search, CancellationToken ctoken);

    Task<Result> SaveAsync(int packageUserId, SaveUserMappingRequest request, CancellationToken ctoken);

    Task<Result> DeleteAsync(int packageUserId, CancellationToken ctoken);
}
