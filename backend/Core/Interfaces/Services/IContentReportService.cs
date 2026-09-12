// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.RequestModels.ContentReport;
using WebDataContracts.ResponseModels.ContentReport;

namespace Core.Interfaces.Services;

public interface IContentReportService
{
    Task<Result<ContentReportResponse?>> CreateAsync(
        string reporterIdentifier, CreateContentReportRequest request, CancellationToken ctoken);

    Task<Result<PagedResult<ContentReportSummaryResponse>>> GetQueueAsync(
        string? status, string? contentType, string? hideOutcome, int page, int pageSize, CancellationToken ctoken);

    Task<Result<ContentReportDetailResponse>> GetDetailAsync(string identifier, CancellationToken ctoken);

    Task<Result<ContentReportCountsResponse>> GetCountsAsync(CancellationToken ctoken);

    Task<Result<PagedResult<ReporterStatisticResponse>>> GetReporterStatisticsAsync(
        int page, int pageSize, CancellationToken ctoken);

    Task<Result<PagedResult<AuthorStatisticResponse>>> GetAuthorStatisticsAsync(
        int page, int pageSize, CancellationToken ctoken);

    Task<Result<ContentReportDetailResponse>> DecideAsync(
        string identifier, DecideContentReportRequest request, string decidedBy, CancellationToken ctoken);
}
