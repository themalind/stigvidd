// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.HikeShare;

namespace Core.Interfaces.Services.HikeShares;

public interface IHikeShareService
{
    // ByUser = you are the owner who shared.
    Task<Result<int>> GetHikeShareCountAsync(string identifier, string hikeIdentifier, CancellationToken ctoken);
    Task<Result<IReadOnlyCollection<OutgoingHikeShareResponse>>> GetOutgoingSharesAsync(string identifier, CancellationToken ctoken);
    Task<Result> ShareHikeAsync(string identifier, string hikeIdentifier, IReadOnlyCollection<string> sharedWithNames, bool allowResharing, CancellationToken ctoken);
}
