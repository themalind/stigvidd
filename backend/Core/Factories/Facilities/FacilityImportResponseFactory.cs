// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Facility;

namespace Core.Factories.Facilities;

public class FacilityImportResponseFactory
{
    public FacilityImportPreviewResponse CreatePreview(
        string source,
        IReadOnlyCollection<FacilityImportRow> rows,
        IReadOnlyCollection<FacilityReference> unlinkedFacilities,
        bool hasWork,
        IReadOnlyCollection<string> notes)
    {
        return new FacilityImportPreviewResponse
        {
            Source = source,
            Rows = rows.Select(CreateRow).ToList(),
            UnlinkedFacilities = unlinkedFacilities
                .Select(f => new FacilityImportCandidateResponse
                {
                    Identifier = f.Identifier,
                    Name = f.Name,
                    FacilityType = (int)f.Type,
                })
                .ToList(),
            HasWork = hasWork,
            Notes = notes,
        };
    }

    public FacilityImportApplyResponse CreateApplied(FacilityImportCounts counts)
    {
        return new FacilityImportApplyResponse
        {
            Created = counts.Created,
            Linked = counts.Linked,
            Updated = counts.Updated,
            Unchanged = counts.Unchanged,
            Missing = counts.Missing,
        };
    }

    private static FacilityImportRowResponse CreateRow(FacilityImportRow row)
    {
        return new FacilityImportRowResponse
        {
            SourceId = row.SourceId,
            Name = row.Name,
            Kind = row.Kind,
            FacilityType = (int)row.Type,
            FacilityIdentifier = row.Facility?.Identifier,
            FacilityName = row.Facility?.Name,
            SuggestedFacilityIdentifier = row.SuggestedFacility?.Identifier,
            SuggestedFacilityName = row.SuggestedFacility?.Name,
            Changes = row.Changes
                .Select(c => new FacilityImportFieldChangeResponse
                {
                    Field = c.Field,
                    Current = c.Current,
                    Incoming = c.Incoming,
                    OverwritesLocalEdit = c.OverwritesLocalEdit,
                    Kept = c.Kept,
                })
                .ToList(),
        };
    }
}
