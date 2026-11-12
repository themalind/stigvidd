// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Facility;

public class FacilityImportApplyResponse
{
    public required int Created { get; set; }
    public required int Linked { get; set; }
    public required int Updated { get; set; }
    public required int Unchanged { get; set; }
    public required int Missing { get; set; }
}
