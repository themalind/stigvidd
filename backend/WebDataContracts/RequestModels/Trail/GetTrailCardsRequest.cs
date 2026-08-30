// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Trail;

public class GetTrailCardsRequest
{
    public required IReadOnlyCollection<string> Identifiers { get; set; }
}
