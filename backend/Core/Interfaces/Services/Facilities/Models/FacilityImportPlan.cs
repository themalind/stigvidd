// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Services.Facilities.Models;

public record FacilityImportPlan(
    IReadOnlyList<FacilityImportRow> Rows,
    IReadOnlyList<FacilityReference> UnlinkedFacilities,
    IReadOnlyList<Facility> Creates,
    IReadOnlyList<Facility> Updates,
    FacilityImportCounts Counts)
{
    public bool HasWork
    {
        get
        {
            return Creates.Count > 0 || Updates.Count > 0;
        }
    }
}
