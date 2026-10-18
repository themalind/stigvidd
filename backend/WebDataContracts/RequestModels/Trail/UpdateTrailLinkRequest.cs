// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Trail;

public class UpdateTrailLinkRequest
{
    public string? Identifier { get; set; }
    public required string Title { get; set; }
    public required string Link { get; set; }
}
