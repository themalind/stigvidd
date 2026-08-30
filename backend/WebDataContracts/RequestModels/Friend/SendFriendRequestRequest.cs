// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Friend;

public class SendFriendRequestRequest
{
    public required string ReceiverNickName { get; set; }
}
