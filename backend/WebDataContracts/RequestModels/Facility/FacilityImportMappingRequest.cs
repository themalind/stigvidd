// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Facility;

// keep-comment: which property of the file's features holds what; field names are the file's own
public class FacilityImportMappingRequest
{
    // keep-comment: null when the file has no stable id; the facilities are then matched on position
    public string? IdField { get; set; }
    public string NameField { get; set; } = string.Empty;
    public string? DescriptionField { get; set; }
    public string? UrlField { get; set; }
    // keep-comment: null gives every feature FixedType; otherwise each value of the field maps through TypeValues
    public string? TypeField { get; set; }
    public int FixedType { get; set; }
    public IReadOnlyCollection<FacilityImportTypeValueRequest> TypeValues { get; set; } = [];
}
