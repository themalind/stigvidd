// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.HikeShare;

public class HikeShareRequest
{
    public required string HikeIdentifier { get; set; }
    public required string SharedWithName { get; set; }
    public bool AllowResharing { get; set; }
}
