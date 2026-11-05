// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.HikeShare;

public class OutgoingHikeShareRecipientResponse
{
    public required string Identifier { get; set; }
    public required string NickName { get; set; }
    public DateTime SharedAt { get; set; }
}
