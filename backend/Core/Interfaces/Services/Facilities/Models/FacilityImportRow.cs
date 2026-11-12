// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Enums;
using WebDataContracts.Enums;

namespace Core.Interfaces.Services.Facilities.Models;

public record FacilityImportRow(
    string SourceId,
    string Name,
    FacilityImportRowKind Kind,
    FacilityType Type,
    FacilityReference? Facility,
    FacilityReference? SuggestedFacility,
    IReadOnlyList<FacilityImportFieldChange> Changes);
