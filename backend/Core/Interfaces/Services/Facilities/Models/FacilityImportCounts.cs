// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Facilities.Models;

public record FacilityImportCounts(int Created, int Linked, int Updated, int Unchanged, int Missing);
