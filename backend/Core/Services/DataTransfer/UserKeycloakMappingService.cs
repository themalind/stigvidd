// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.UserMapping;
using WebDataContracts.ResponseModels.UserMapping;

namespace Core.Services.DataTransfer;

public class UserKeycloakMappingService : IUserKeycloakMappingService
{
    private const int MinSearchLength = 3;
    private const int MaxSearchResults = 20;

    private readonly IUserKeycloakMappingRepository _repository;
    private readonly IKeycloakAdminRepository _keycloak;
    private readonly ILogger<UserKeycloakMappingService> _logger;
    private readonly bool _sharedServices;

    private static readonly Message Unavailable =
        new(404, "User mapping is only available on a host that shares another host's Keycloak.");

    public UserKeycloakMappingService(
        IUserKeycloakMappingRepository repository,
        IKeycloakAdminRepository keycloak,
        IConfiguration configuration,
        ILogger<UserKeycloakMappingService> logger)
    {
        _repository = repository;
        _keycloak = keycloak;
        _logger = logger;
        _sharedServices = configuration.GetValue<bool>("DataTransfer:SharedServices");
    }

    public async Task<Result<UserMappingsResponse>> GetAsync(CancellationToken ctoken)
    {
        if (!_sharedServices)
            return Result.Fail<UserMappingsResponse>(Unavailable);

        var mappings = await _repository.ListMappingsAsync(ctoken);
        var users = await _repository.ListUsersAsync(ctoken);

        if (!mappings.IsSuccess || !users.IsSuccess)
            return Result.Fail<UserMappingsResponse>(new Message(500, "The user mappings could not be read."));

        var mapped = mappings.Value.Select(m => m.PackageUserId).ToHashSet();

        return Result.Ok(new UserMappingsResponse
        {
            Users = users.Value
                .Select(u => new MappableUserResponse
                {
                    Id = u.Id,
                    NickName = u.NickName,
                    Email = u.Email,
                    HikeCount = u.HikeCount,
                    IsMapped = mapped.Contains(u.Id),
                })
                .ToList(),
            Mappings = mappings.Value
                .Select(m => new UserMappingResponse
                {
                    PackageUserId = m.PackageUserId,
                    KeycloakSubjectId = m.KeycloakSubjectId,
                    KeycloakUsername = m.KeycloakUsername,
                    NickName = m.NickName,
                    Email = m.Email,
                    CreatedAt = m.CreatedAt,
                })
                .ToList(),
        });
    }

    public async Task<Result<IReadOnlyList<KeycloakUserResponse>>> SearchKeycloakUsersAsync(string? search, CancellationToken ctoken)
    {
        if (!_sharedServices)
            return Result.Fail<IReadOnlyList<KeycloakUserResponse>>(Unavailable);

        var term = search?.Trim();
        if (term is null || term.Length < MinSearchLength)
            return Result.Fail<IReadOnlyList<KeycloakUserResponse>>(
                new Message(400, $"Search needs at least {MinSearchLength} characters."));

        var found = await _keycloak.SearchUsersAsync(term, MaxSearchResults, ctoken);

        IReadOnlyList<KeycloakUserResponse> response = found
            .Select(u => new KeycloakUserResponse { Id = u.Id, Username = u.Username, Email = u.Email, Enabled = u.Enabled })
            .ToList();

        return Result.Ok(response);
    }

    public async Task<Result> SaveAsync(int packageUserId, SaveUserMappingRequest request, CancellationToken ctoken)
    {
        if (!_sharedServices)
            return Result.Fail(Unavailable);

        var keycloakUser = await _keycloak.FindUserAsync(request.KeycloakSubjectId, ctoken);
        if (keycloakUser is null)
            return Result.Fail(new Message(404, "There is no Keycloak user with that id."));

        var saved = await _repository.SaveAsync(new UserKeycloakMapping
        {
            PackageUserId = packageUserId,
            KeycloakSubjectId = keycloakUser.Id,
            KeycloakUsername = keycloakUser.Username,
            NickName = request.NickName,
            Email = request.Email,
        }, ctoken);

        if (saved.Status == RepositoryResultStatus.Conflict)
            return Result.Fail(new Message(409, "That Keycloak user or nickname already belongs to another mapping."));

        if (!saved.IsSuccess)
            return Result.Fail(new Message(500, "The mapping could not be saved."));

        _logger.LogInformation("UserKeycloakMappingService: user {PackageUserId} mapped to Keycloak user {SubjectId}.", packageUserId, keycloakUser.Id);

        return Result.Ok();
    }

    public async Task<Result> DeleteAsync(int packageUserId, CancellationToken ctoken)
    {
        if (!_sharedServices)
            return Result.Fail(Unavailable);

        var deleted = await _repository.DeleteAsync(packageUserId, ctoken);

        if (deleted.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, "There is no mapping for that user."));

        return deleted.IsSuccess ? Result.Ok() : Result.Fail(new Message(500, "The mapping could not be removed."));
    }
}
