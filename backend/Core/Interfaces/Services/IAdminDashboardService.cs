// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Admin;

namespace Core.Interfaces.Services;

public interface IAdminDashboardService
{
    Task<Result<AdminDashboardResponse>> GetDashboardAsync(CancellationToken ctoken);
}
