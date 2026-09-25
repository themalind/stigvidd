// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Microsoft.Extensions.Configuration;
using WebDataContracts.RequestModels.Media;
using WebDataContracts.ResponseModels.Media;

namespace Core.Services;

public class MediaService : IMediaService
{
    private readonly IMediaRepository _mediaRepository;
    private readonly string _presentableBaseUrl;

    public MediaService(IMediaRepository mediaRepository, IConfiguration configuration)
    {
        _mediaRepository = mediaRepository;
        _presentableBaseUrl = configuration["PresentableBaseUrl"]
            ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public async Task<Result<MediaLibraryPageResponse>> GetMediaAsync(MediaLibraryQuery query, CancellationToken ctoken)
    {
        var result = await _mediaRepository.GetMediaPagedAsync(query, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<MediaLibraryPageResponse>(new Message(500, "An error occurred while fetching media."));

        var page = result.Value;

        IReadOnlyCollection<MediaItemResponse> items = page.Items
            .Select(m => MediaItemResponse.Create(
                _presentableBaseUrl, m.Identifier, m.ImageUrl, m.AltText, m.Caption,
                m.Width, m.Height, m.SizeBytes, m.CreatedAt, m.OwnerType, m.OwnerIdentifier, m.OwnerName))
            .ToList();

        return Result.Ok(new MediaLibraryPageResponse
        {
            Items = items,
            Page = page.Page,
            HasMore = page.HasMore,
            TotalCount = page.TotalCount,
            ReprocessableCount = page.ReprocessableCount,
            TotalSizeBytes = page.TotalSizeBytes
        });
    }

    public async Task<Result> UpdateImageMetadataAsync(string imageIdentifier, string? altText, string? caption, CancellationToken ctoken)
    {
        var result = await _mediaRepository.UpdateImageMetadataAsync(imageIdentifier, altText, caption, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while updating image metadata."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Image with identifier {imageIdentifier} not found."));

        return Result.Ok();
    }
}
