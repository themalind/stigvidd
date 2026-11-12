// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.Enums;

namespace Core.Interfaces.Services.Facilities.Models;

public record FacilityImportFieldChange(FacilityImportField Field, string? Current, string? Incoming, bool OverwritesLocalEdit, bool Kept);
