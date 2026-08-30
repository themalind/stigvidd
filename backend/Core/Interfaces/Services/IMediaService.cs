// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using WebDataContracts.ResponseModels.Media;

namespace Core.Interfaces.Services;

public interface IMediaService
{
    Task<Result<IReadOnlyCollection<MediaItemResponse>>> GetAllMediaAsync(CancellationToken ctoken);
    Task<Result> UpdateImageMetadataAsync(string imageIdentifier, string? altText, string? caption, CancellationToken ctoken);
}
