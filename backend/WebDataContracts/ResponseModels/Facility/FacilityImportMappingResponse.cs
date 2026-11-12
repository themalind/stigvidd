// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Facility;

public class FacilityImportMappingResponse
{
    public required string? IdField { get; set; }
    public required string NameField { get; set; }
    public required string? DescriptionField { get; set; }
    public required string? UrlField { get; set; }
    public required string? TypeField { get; set; }
    public required int FixedType { get; set; }
    public required IReadOnlyCollection<FacilityImportTypeValueResponse> TypeValues { get; set; }
}
