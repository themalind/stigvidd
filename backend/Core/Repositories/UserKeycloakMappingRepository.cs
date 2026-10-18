// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Services;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Core.Repositories;

public class UserKeycloakMappingRepository : IUserKeycloakMappingRepository
{
    private readonly IDbContextFactory<StigViddDbContext> _context;
    private readonly ILogger<UserKeycloakMappingRepository> _logger;

    public UserKeycloakMappingRepository(IDbContextFactory<StigViddDbContext> context, ILogger<UserKeycloakMappingRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<RepositoryResult<IReadOnlyList<UserKeycloakMapping>>> ListMappingsAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var mappings = await context.UserKeycloakMappings
                .AsNoTracking()
                .OrderBy(m => m.PackageUserId)
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyList<UserKeycloakMapping>>.Success(mappings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing user mappings");
            return RepositoryResult<IReadOnlyList<UserKeycloakMapping>>.Error();
        }
    }

    public async Task<RepositoryResult<IReadOnlyList<MappableUser>>> ListUsersAsync(CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var users = await context.Users
                .AsNoTracking()
                .OrderBy(u => u.Id)
                .Select(u => new MappableUser(
                    u.Id,
                    u.NickName,
                    u.Email,
                    context.Hikes.Count(h => h.UserId == u.Id)))
                .ToListAsync(ctoken);

            return RepositoryResult<IReadOnlyList<MappableUser>>.Success(users);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing users for mapping");
            return RepositoryResult<IReadOnlyList<MappableUser>>.Error();
        }
    }

    public async Task<RepositoryResult> SaveAsync(UserKeycloakMapping mapping, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var clash = await context.UserKeycloakMappings.AnyAsync(m =>
                m.PackageUserId != mapping.PackageUserId
                && (m.KeycloakSubjectId == mapping.KeycloakSubjectId || m.NickName == mapping.NickName), ctoken);
            if (clash)
                return RepositoryResult.Conflict();

            await using var transaction = await context.Database.BeginTransactionAsync(ctoken);

            var existing = await context.UserKeycloakMappings.FindAsync([mapping.PackageUserId], ctoken);
            if (existing is null)
            {
                context.UserKeycloakMappings.Add(mapping);
            }
            else
            {
                existing.KeycloakSubjectId = mapping.KeycloakSubjectId;
                existing.KeycloakUsername = mapping.KeycloakUsername;
                existing.NickName = mapping.NickName;
                existing.Email = mapping.Email;
            }

            await context.SaveChangesAsync(ctoken);
            await UserKeycloakMappingApplier.ApplyOneAsync(context, mapping, ctoken);
            await transaction.CommitAsync(ctoken);

            return RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving the mapping for user {PackageUserId}", mapping.PackageUserId);
            return RepositoryResult.Error();
        }
    }

    public async Task<RepositoryResult> DeleteAsync(int packageUserId, CancellationToken ctoken)
    {
        try
        {
            using var context = await _context.CreateDbContextAsync(ctoken);

            var deleted = await context.UserKeycloakMappings
                .Where(m => m.PackageUserId == packageUserId)
                .ExecuteDeleteAsync(ctoken);

            return deleted == 0 ? RepositoryResult.NotFound() : RepositoryResult.Success();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting the mapping for user {PackageUserId}", packageUserId);
            return RepositoryResult.Error();
        }
    }
}
