// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.Facility;

public class FacilityImportRequest
{
    // keep-comment: the dataset the file belongs to; its key scopes the source ids, so one dataset never touches another's
    public string SourceIdentifier { get; set; } = string.Empty;
    public string GeoJson { get; set; } = string.Empty;
    public FacilityImportMappingRequest Mapping { get; set; } = new();
    // keep-comment: a New row left out takes the suggested facility, or is created when there is none
    public IReadOnlyCollection<FacilityImportLinkRequest> Links { get; set; } = [];
    // keep-comment: fields that keep our value; the file's value still becomes the baseline, so ours then counts as a local edit
    public IReadOnlyCollection<FacilityImportKeepRequest> Kept { get; set; } = [];
}
