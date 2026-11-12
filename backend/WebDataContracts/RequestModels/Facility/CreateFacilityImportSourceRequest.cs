// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Facility;

public class CreateFacilityImportSourceRequest
{
    public string MunicipalityIdentifier { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
