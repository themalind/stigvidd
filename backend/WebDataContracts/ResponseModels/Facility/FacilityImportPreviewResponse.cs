// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.Facility;

public class FacilityImportPreviewResponse
{
    public required string Source { get; set; }
    public required IReadOnlyCollection<FacilityImportRowResponse> Rows { get; set; }
    public required IReadOnlyCollection<FacilityImportCandidateResponse> UnlinkedFacilities { get; set; }
    // keep-comment: true when applying would write anything, including a refreshed baseline on an Unchanged row
    public required bool HasWork { get; set; }
    // keep-comment: what the file reader changed to store a site, such as a shortened name or a dropped link
    public required IReadOnlyCollection<string> Notes { get; set; }
}
