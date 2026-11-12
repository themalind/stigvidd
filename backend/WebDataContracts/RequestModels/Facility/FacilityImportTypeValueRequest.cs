// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Facility;

public class FacilityImportTypeValueRequest
{
    public string Value { get; set; } = string.Empty;
    // keep-comment: FacilityType flags; 0 leaves features with this value out of the import
    public int FacilityType { get; set; }
}
