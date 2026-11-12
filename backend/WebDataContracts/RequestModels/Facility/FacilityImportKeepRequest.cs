// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace WebDataContracts.RequestModels.Facility;

public class FacilityImportKeepRequest
{
    public string SourceId { get; set; } = string.Empty;
    public FacilityImportField Field { get; set; }
}
