// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Core.Services;

public static class UserKeycloakMappingApplier
{
    // Returns how many mappings found their user. A mapping whose user is absent is kept for a later import. keep-comment: why a miss is not an error
    public static async Task<int> ApplyAsync(StigViddDbContext db, CancellationToken ctoken)
    {
        var mappings = await db.UserKeycloakMappings.AsNoTracking().ToListAsync(ctoken);
        if (mappings.Count == 0)
            return 0;

        await using var transaction = await db.Database.BeginTransactionAsync(ctoken);

        var applied = 0;
        foreach (var mapping in mappings)
        {
            if (await ApplyOneAsync(db, mapping, ctoken))
                applied++;
        }

        await transaction.CommitAsync(ctoken);

        return applied;
    }

    public static async Task<bool> ApplyOneAsync(StigViddDbContext db, UserKeycloakMapping mapping, CancellationToken ctoken)
    {
        var id = mapping.PackageUserId;
        if (!await db.Users.AnyAsync(u => u.Id == id, ctoken))
            return false;

        var nickName = mapping.NickName;
        var subjectId = mapping.KeycloakSubjectId;

        // Nickname is unique, and a sign-in resolves by SubjectId with FirstOrDefault, so a second holder of either would silently take the wrong account. keep-comment: why the others are moved aside first
        var nickNameHolders = await db.Users.Where(u => u.Id != id && u.NickName == nickName).Select(u => u.Id).ToListAsync(ctoken);
        foreach (var holder in nickNameHolders)
        {
            await db.Users.Where(u => u.Id == holder)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.NickName, "user-" + holder), ctoken);
        }

        var subjectHolders = await db.Users.Where(u => u.Id != id && u.SubjectId == subjectId).Select(u => u.Id).ToListAsync(ctoken);
        foreach (var holder in subjectHolders)
        {
            var replacement = Guid.NewGuid().ToString();
            await db.Users.Where(u => u.Id == holder)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.SubjectId, replacement), ctoken);
        }

        var now = DateTime.UtcNow;
        await db.Users.Where(u => u.Id == id).ExecuteUpdateAsync(s => s
            .SetProperty(u => u.SubjectId, subjectId)
            .SetProperty(u => u.NickName, nickName)
            .SetProperty(u => u.Email, mapping.Email)
            .SetProperty(u => u.EmailVerifiedAt, u => u.EmailVerifiedAt ?? now), ctoken);

        await db.Hikes.Where(h => h.UserId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(h => h.CreatedByNickName, nickName), ctoken);

        return true;
    }
}
