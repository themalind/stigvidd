// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.CityAreas;

// keep-comment: runs after the save; a failure is only logged and caught up by "Recalculate all" in admin
public interface ICityAreaMembershipService
{
    Task TrailsMovedAsync(IReadOnlyCollection<int> trailIds, CancellationToken ctoken);
    Task FacilitiesMovedAsync(IReadOnlyCollection<int> facilityIds, CancellationToken ctoken);
}
