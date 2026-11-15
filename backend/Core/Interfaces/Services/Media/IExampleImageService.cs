// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace Core.Interfaces.Services.Media;

public interface IExampleImageService
{
    Task<Result> AddToTrailsAsync(IReadOnlyCollection<int> trailIds, CancellationToken ctoken);
}
