// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.DataTransfer;

namespace Core.Interfaces.Services;

public interface IDataTransferService
{
    DataTransferInfoResponse GetInfo();

    // The archive is a temporary file, deleted when the returned stream is closed. keep-comment: caller owns cleanup via dispose
    Task<Stream> CreateExportAsync(bool anonymize, CancellationToken ctoken);

    // DESTRUCTIVE. Throws InvalidOperationException for an archive it refuses, before anything is replaced. keep-comment: error contract the controller relies on
    Task<DataTransferImportResponse> ImportAsync(Stream input, CancellationToken ctoken);
}
