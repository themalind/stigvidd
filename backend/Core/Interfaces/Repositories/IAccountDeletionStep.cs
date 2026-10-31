// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Services;
using Infrastructure.Data;

namespace Core.Interfaces.Repositories;

public sealed record AccountDeletionEffects(IReadOnlyList<string> FileUrls, IReadOnlyList<PushMessage> Pushes);

// Runs inside the deletion transaction; it sends nothing itself and hands back what must happen after commit. keep-comment: a Keycloak failure rolls back after the steps
public interface IAccountDeletionStep
{
    Task<AccountDeletionEffects> RunAsync(StigViddDbContext context, int userId, CancellationToken ctoken);
}
