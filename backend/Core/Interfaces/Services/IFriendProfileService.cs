// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Friend;

namespace Core.Interfaces.Services;

public interface IFriendProfileService
{
    Task<Result<FriendProfileResponse>> GetProfileAsync(string currentUserIdentifier, string friendIdentifier, CancellationToken ctoken);
}
