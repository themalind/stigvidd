// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Facility;

public class FacilityImportLinkRequest
{
    public string SourceId { get; set; } = string.Empty;
    // keep-comment: null creates a new facility for the row
    public string? FacilityIdentifier { get; set; }
}
