// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Facility;

public class FacilityImportTypeValueResponse
{
    public required string Value { get; set; }
    public required int FacilityType { get; set; }
}
