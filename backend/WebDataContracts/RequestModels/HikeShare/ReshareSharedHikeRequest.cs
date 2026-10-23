// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.HikeShare;

public class ReshareSharedHikeRequest
{
    public required string HikeIdentifier { get; set; }
    public IReadOnlyCollection<string> ReShareToNames { get; set; } = [];

    // keep-comment: store builds 6 and 8 send one name here; remove once a newer store build replaces them
    public string? ReShareToName
    {
        get => null;
        set { if (value is not null && ReShareToNames is null or { Count: 0 }) ReShareToNames = [value]; }
    }
}
