// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.Facility;

public class FacilityImportRowResponse
{
    public required string SourceId { get; set; }
    public required string Name { get; set; }
    public required FacilityImportRowKind Kind { get; set; }
    // keep-comment: FacilityType flags the file gives the row; a Missing row has the facility's own
    public required int FacilityType { get; set; }

    public required string? FacilityIdentifier { get; set; }
    public required string? FacilityName { get; set; }

    // keep-comment: a New row's likely hand-entered twin; Changes are measured against it
    public required string? SuggestedFacilityIdentifier { get; set; }
    public required string? SuggestedFacilityName { get; set; }

    public required IReadOnlyCollection<FacilityImportFieldChangeResponse> Changes { get; set; }
}
