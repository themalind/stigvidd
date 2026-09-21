// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.Media;
using WebDataContracts.ResponseModels.Media;

namespace Core.Interfaces.Services;

public interface IMediaReprocessService
{
    Task<Result<MediaReprocessJobSummaryResponse>> EnqueueBatchAsync(
        CreateMediaReprocessJobRequest request,
        CancellationToken ctoken);

    Task<Result<PagedResult<MediaReprocessJobSummaryResponse>>> GetJobsPagedAsync(
        int page, int pageSize, CancellationToken ctoken);

    Task<Result<MediaReprocessJobDetailResponse>> GetJobDetailAsync(string identifier, CancellationToken ctoken);

    Task<Result<MediaReprocessJobSummaryResponse>> CancelJobAsync(string identifier, CancellationToken ctoken);
}
