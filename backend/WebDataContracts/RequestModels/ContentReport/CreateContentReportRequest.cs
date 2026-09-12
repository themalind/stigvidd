// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.RequestModels.ContentReport;

public class CreateContentReportRequest
{
    public required string ContentType { get; set; }
    public required string ContentIdentifier { get; set; }
    public required string Reason { get; set; }
    public string? ReporterNote { get; set; }
}
