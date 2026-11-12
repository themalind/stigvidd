// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.ResponseModels.Facility;

public class FacilityImportFieldChangeResponse
{
    public required FacilityImportField Field { get; set; }
    public required string? Current { get; set; }
    public required string? Incoming { get; set; }

    // keep-comment: the source changed a field an admin had also edited, and the source wins
    public required bool OverwritesLocalEdit { get; set; }

    // keep-comment: the admin chose to keep our value; the change is shown but not applied
    public required bool Kept { get; set; }
}
