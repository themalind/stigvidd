// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services;

public interface IHikeShareService
{
    // ByUser = you are the owner who shared.
    Task<Result<int>> GetHikeShareCountAsync(string identifier, string hikeIdentifier, CancellationToken ctoken);
    Task<Result> ShareHikeAsync(string identifier, string hikeIdentifier, string sharedWithName, bool allowResharing, CancellationToken ctoken);
}
