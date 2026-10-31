// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.EntityFrameworkCore;

namespace Core.Repositories;

// Recorded in the caller's context, so the log row commits or rolls back with the action itself. Never saves. keep-comment: callers own the transaction
internal static class UserActionLogs
{
    // Prunes the user's rows that have left the window, so the table stays at most one window per user. keep-comment: no retention job needed
    public static Task RecordAsync(StigViddDbContext context, int userId, UserAction action, DateTime now, TimeSpan window, CancellationToken ctoken)
    {
        return RecordAsync(context, userId, action, now, window, times: 1, ctoken);
    }

    public static async Task RecordAsync(StigViddDbContext context, int userId, UserAction action, DateTime now, TimeSpan window, int times, CancellationToken ctoken)
    {
        var cutoff = now - window;

        context.UserActionLogs.RemoveRange(await context.UserActionLogs
            .Where(l => l.UserId == userId && l.Action == action && l.CreatedAt < cutoff)
            .ToListAsync(ctoken));

        for (var i = 0; i < times; i++)
            context.UserActionLogs.Add(new UserActionLog { UserId = userId, Action = action, CreatedAt = now });
    }

    public static Task<int> CountSinceAsync(StigViddDbContext context, int userId, UserAction action, DateTime since, CancellationToken ctoken)
    {
        return context.UserActionLogs.CountAsync(l => l.UserId == userId && l.Action == action && l.CreatedAt >= since, ctoken);
    }
}
