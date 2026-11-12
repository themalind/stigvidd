// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Microsoft.Extensions.Logging;

namespace Core.Services.CityAreas;

public class CityAreaMembershipService : ICityAreaMembershipService
{
    private readonly ICityAreaRepository _cityAreaRepository;
    private readonly ILogger<CityAreaMembershipService> _logger;

    public CityAreaMembershipService(ICityAreaRepository cityAreaRepository, ILogger<CityAreaMembershipService> logger)
    {
        _cityAreaRepository = cityAreaRepository;
        _logger = logger;
    }

    public async Task TrailsMovedAsync(IReadOnlyCollection<int> trailIds, CancellationToken ctoken)
    {
        if (trailIds.Count == 0)
            return;

        var result = await _cityAreaRepository.RecalculateTrailsAsync(trailIds, ctoken);

        if (!result.IsSuccess)
            _logger.LogWarning("CityAreaMembershipService: Could not recalculate the areas of {Count} trail(s).", trailIds.Count);
    }

    public async Task FacilitiesMovedAsync(IReadOnlyCollection<int> facilityIds, CancellationToken ctoken)
    {
        if (facilityIds.Count == 0)
            return;

        var result = await _cityAreaRepository.RecalculateFacilitiesAsync(facilityIds, ctoken);

        if (!result.IsSuccess)
            _logger.LogWarning("CityAreaMembershipService: Could not recalculate the areas of {Count} facilities.", facilityIds.Count);
    }
}
