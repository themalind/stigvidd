// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Infrastructure.Data.Entities;

namespace Core.Interfaces.Services.Facilities.Models;

public record PlannedFacilityImport(
    FacilityImportSource Source,
    FacilityImportMapping Mapping,
    FacilityImportPlan Plan,
    IReadOnlyCollection<string> Notes);
