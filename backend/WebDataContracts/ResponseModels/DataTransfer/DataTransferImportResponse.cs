// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

namespace WebDataContracts.ResponseModels.DataTransfer;

public class DataTransferImportResponse
{
    public required string Message { get; set; }
    public bool Anonymized { get; set; }
    public bool KeycloakRestored { get; set; }
    public bool OutboundCleared { get; set; }
    public int MediaRestored { get; set; }
    public int MediaFailed { get; set; }
    public int TrailImportFilesRestored { get; set; }
    public IReadOnlyList<string> Notes { get; set; } = [];
    public IReadOnlyList<string> RestartServices { get; set; } = [];
}
