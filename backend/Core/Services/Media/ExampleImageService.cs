// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Repositories.Trails.Models;
using Core.Interfaces.Services;
using Microsoft.Extensions.Logging;

namespace Core.Services.Media;

public class ExampleImageService : IExampleImageService
{
    // keep-comment: the set is every image file directly in this folder, and an image whose URL contains it is an example - the app uses the same rule (app/src/components/media/is-mock-image.ts)
    public const string Folder = "mock";

    private static readonly string[] ImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    private static readonly Message NotListed = new(502, $"The example images in {Folder}/ could not be listed.");

    private readonly IWebDavService _webDav;
    private readonly IImageProcessingService _imageProcessing;
    private readonly ITrailRepository _trailRepository;
    private readonly ILogger<ExampleImageService> _logger;

    public ExampleImageService(
        IWebDavService webDav,
        IImageProcessingService imageProcessing,
        ITrailRepository trailRepository,
        ILogger<ExampleImageService> logger)
    {
        _webDav = webDav;
        _imageProcessing = imageProcessing;
        _trailRepository = trailRepository;
        _logger = logger;
    }

    public async Task<Result> AddToTrailsAsync(IReadOnlyCollection<int> trailIds, CancellationToken ctoken)
    {
        if (trailIds.Count == 0)
            return Result.Ok();

        var files = await MeasureAllAsync();

        if (files.IsFailure || files.Value is null)
            return Result.Fail(files.Message ?? NotListed);

        if (files.Value.Count == 0)
            return Result.Fail(new Message(409, $"There are no example images in {Folder}/."));

        var added = await _trailRepository.AddMissingTrailImagesAsync(trailIds, files.Value, ctoken);

        return added.IsSuccess
            ? Result.Ok()
            : Result.Fail(new Message(500, "An error occurred while adding the example images."));
    }

    private async Task<Result<IReadOnlyCollection<string>>> ListAsync()
    {
        try
        {
            var listed = await _webDav.ListFilesAsync(Folder);

            if (listed.IsFailure || listed.Value is null)
                return Result.Fail<IReadOnlyCollection<string>>(NotListed);

            IReadOnlyCollection<string> images = listed.Value
                .Where(path => ImageExtensions.Contains(Path.GetExtension(path).ToLowerInvariant()))
                .Order(StringComparer.Ordinal)
                .ToList();

            return Result.Ok(images);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ExampleImageService: ListAsync -> could not list {Folder}.", Folder);
            return Result.Fail<IReadOnlyCollection<string>>(NotListed);
        }
    }

    // keep-comment: each file is downloaded once to read its size, which the app needs to frame a cover image
    private async Task<Result<IReadOnlyCollection<ExampleImageFile>>> MeasureAllAsync()
    {
        var paths = await ListAsync();

        if (paths.IsFailure || paths.Value is null)
            return Result.Fail<IReadOnlyCollection<ExampleImageFile>>(paths.Message ?? NotListed);

        var files = new List<ExampleImageFile>();

        foreach (var path in paths.Value)
        {
            try
            {
                var download = await _webDav.DownloadAsync(path);

                if (download.IsFailure || download.Value is null)
                {
                    _logger.LogWarning("ExampleImageService: skipped {Path}, it could not be downloaded.", path);
                    continue;
                }

                await using var stream = download.Value;
                var size = _imageProcessing.Measure(stream);
                files.Add(new ExampleImageFile(path, size.Width, size.Height, stream.Length));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "ExampleImageService: skipped {Path}, it could not be read as an image.", path);
            }
        }

        return Result.Ok<IReadOnlyCollection<ExampleImageFile>>(files);
    }
}
