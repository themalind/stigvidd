// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Facility;

public class FacilityImportSourceResponse
{
    public required string Identifier { get; set; }
    public required string Name { get; set; }
    public required string Key { get; set; }
    public required string MunicipalityIdentifier { get; set; }
    public required string MunicipalityName { get; set; }
    // keep-comment: null until the first import of the source is applied
    public required FacilityImportMappingResponse? Mapping { get; set; }
}
