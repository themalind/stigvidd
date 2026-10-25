// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Core.Repositories;
using Core.TrailImport.Matching;
using Core.Validators.HikeSubmission;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using System.Runtime.CompilerServices;
using WebDataContracts.RequestModels.HikeSubmission;
using WebDataContracts.ResponseModels.HikeSubmission;

namespace Core.Services;

public class HikeSubmissionService : IHikeSubmissionService
{
    private readonly IHikeSubmissionRepository _submissionRepository;
    private readonly IHikeRepository _hikeRepository;
    private readonly IUserRepository _userRepository;
    private readonly ITrailService _trailService;
    private readonly IWebDavService _webDavService;
    private readonly IMediaUploadService _mediaUploadService;
    private readonly TrailResponseFactory _trailResponseFactory;
    private readonly IReadOnlyCollection<string> _placeholderImagePaths;
    private readonly ILogger<HikeSubmissionService> _logger;

    public HikeSubmissionService(
        IHikeSubmissionRepository submissionRepository,
        IHikeRepository hikeRepository,
        IUserRepository userRepository,
        ITrailService trailService,
        IWebDavService webDavService,
        IMediaUploadService mediaUploadService,
        TrailResponseFactory trailResponseFactory,
        IConfiguration configuration,
        ILogger<HikeSubmissionService> logger)
    {
        _submissionRepository = submissionRepository;
        _hikeRepository = hikeRepository;
        _userRepository = userRepository;
        _trailService = trailService;
        _webDavService = webDavService;
        _mediaUploadService = mediaUploadService;
        _trailResponseFactory = trailResponseFactory;
        _placeholderImagePaths = configuration.GetSection("CommunityTrails:PlaceholderImagePaths").Get<string[]>() ?? [];
        _logger = logger;
    }

    public async Task<Result<HikeSubmissionResponse>> CreateAsync(CreateHikeSubmissionRequest request, string userIdentifier, CancellationToken ctoken)
    {
        var consentResult = await _submissionRepository.GetConsentTextIdAsync(request.ConsentVersion, request.ConsentLocale, ctoken);

        if (consentResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<HikeSubmissionResponse>(new Message(500, "An error occurred while fetching the consent text."));

        if (!consentResult.IsSuccess)
            return Result.Fail<HikeSubmissionResponse>(new Message(400, "Unknown consent language."));

        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (userIdResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<HikeSubmissionResponse>(new Message(500, "An error occurred while fetching the user."));

        if (!userIdResult.IsSuccess)
            return Result.Fail<HikeSubmissionResponse>(new Message(404, "User not found"));

        var hikeResult = await _hikeRepository.GetHikeByIdentifierAsync(request.HikeIdentifier, ctoken);

        if (hikeResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<HikeSubmissionResponse>(new Message(500, "An error occurred while fetching the hike."));

        if (!hikeResult.IsSuccess)
            return Result.Fail<HikeSubmissionResponse>(new Message(404, "Hike not found"));

        var hike = hikeResult.Value;

        if (hike.UserId != userIdResult.Value)
            return Result.Fail<HikeSubmissionResponse>(new Message(403, "Hike does not belong to the user"));

        var pendingResult = await _submissionRepository.HasPendingForHikeAsync(hike.Id, ctoken);

        if (!pendingResult.IsSuccess)
            return Result.Fail<HikeSubmissionResponse>(new Message(500, "An error occurred while checking earlier submissions."));

        if (pendingResult.Value)
            return Result.Fail<HikeSubmissionResponse>(new Message(409, "This hike is already waiting for review."));

        var publishedResult = await _submissionRepository.HasPublishedForHikeAsync(hike.Id, ctoken);

        if (!publishedResult.IsSuccess)
            return Result.Fail<HikeSubmissionResponse>(new Message(500, "An error occurred while checking earlier submissions."));

        if (publishedResult.Value)
            return Result.Fail<HikeSubmissionResponse>(new Message(409, "This hike is already published as a trail."));

        var pendingCountResult = await _submissionRepository.CountPendingByUserAsync(userIdResult.Value, ctoken);

        if (!pendingCountResult.IsSuccess)
            return Result.Fail<HikeSubmissionResponse>(new Message(500, "An error occurred while checking earlier submissions."));

        if (pendingCountResult.Value >= HikeSubmissionLimits.PendingPerUser)
            return Result.Fail<HikeSubmissionResponse>(new Message(429, $"At most {HikeSubmissionLimits.PendingPerUser} walks can wait for review at a time."));

        var path = Trim(hike.GeoPath, request.TrimStartIndex, request.TrimEndIndex);

        if (path is null)
            return Result.Fail<HikeSubmissionResponse>(new Message(400, "The trim indexes do not leave a path."));

        var chosen = (hike.Images ?? [])
            .Where(i => i.ModerationState == ModerationState.Visible && request.ImageIdentifiers.Contains(i.Identifier))
            .ToList();

        var copies = await Task.WhenAll(chosen.Select(CopyImageAsync));
        var copied = copies.OfType<HikeSubmissionImage>().ToList();

        if (copied.Count != copies.Length)
        {
            await DeleteFilesAsync(copied.Select(c => c.ImageUrl), $"Rollback of a submission for hike {hike.Identifier}");
            return Result.Fail<HikeSubmissionResponse>(new Message(500, "Could not copy the images. Try again later."));
        }

        for (var i = 0; i < copied.Count; i++)
            copied[i].SortOrder = i;

        var submission = new HikeSubmission
        {
            UserId = userIdResult.Value,
            SourceHikeId = hike.Id,
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            GeoPath = path,
            OriginalGeoPath = path.Copy() is LineString original ? original : path,
            TrailLength = PathMetrics.LengthKm(path),
            LongestGapMetres = PathMetrics.LongestGapMetres(path),
            Classification = request.Classification,
            Parking = request.Parking?.Trim() ?? string.Empty,
            GettingThere = request.GettingThere.Trim(),
            PublicTransport = request.PublicTransport?.Trim() ?? string.Empty,
            AccessibilityInfo = request.AccessibilityInfo?.Trim() ?? string.Empty,
            City = request.City.Trim(),
            ShowSubmitterName = request.ShowSubmitterName,
            TransferAcceptedAt = DateTime.UtcNow,
            ConsentTextId = consentResult.Value,
            Images = copied,
        };

        var addResult = await _submissionRepository.AddAsync(submission, ctoken);

        if (!addResult.IsSuccess)
        {
            await DeleteFilesAsync(copied.Select(c => c.ImageUrl), $"Rollback of a submission for hike {hike.Identifier}");

            return addResult.Status == RepositoryResultStatus.Conflict
                ? Result.Fail<HikeSubmissionResponse>(new Message(409, "This hike is already waiting for review."))
                : Result.Fail<HikeSubmissionResponse>(new Message(500, "An error occurred while saving the submission."));
        }

        return Result.Ok(new HikeSubmissionResponse
        {
            Identifier = submission.Identifier,
            Name = submission.Name,
            TrailLength = submission.TrailLength,
            Status = submission.Status.ToString(),
            CreatedAt = submission.CreatedAt,
            SourceHikeIdentifier = hike.Identifier,
            ImageUrl = copied.Count != 0 ? _trailResponseFactory.PresentableBaseUrl + copied[0].ImageUrl : null,
        });
    }

    public async Task<Result<IReadOnlyCollection<HikeSubmissionResponse>>> GetMineAsync(string userIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (userIdResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<IReadOnlyCollection<HikeSubmissionResponse>>(new Message(500, "An error occurred while fetching the user."));

        if (!userIdResult.IsSuccess)
            return Result.Fail<IReadOnlyCollection<HikeSubmissionResponse>>(new Message(404, "User not found"));

        var result = await _submissionRepository.GetByUserIdAsync(
            userIdResult.Value,
            s => new
            {
                s.Identifier,
                s.Name,
                s.TrailLength,
                s.Status,
                s.RejectionReason,
                s.CreatedAt,
                s.DecidedAt,
                SourceHikeIdentifier = s.SourceHike != null ? s.SourceHike.Identifier : null,
                PublishedTrailIdentifier = s.PublishedTrail != null ? s.PublishedTrail.Identifier : null,
                ImageUrl = s.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).FirstOrDefault(),
            },
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<HikeSubmissionResponse>>(new Message(500, "An error occurred while fetching submissions."));

        var published = result.Value
            .Select(s => s.PublishedTrailIdentifier)
            .OfType<string>()
            .ToList();

        var cards = published.Count == 0
            ? []
            : (await _trailService.GetTrailCardsByIdentifiersAsync(published, ctoken)).Value ?? [];

        var cardByIdentifier = cards.ToDictionary(c => c.Identifier);
        var baseUrl = _trailResponseFactory.PresentableBaseUrl;

        IReadOnlyCollection<HikeSubmissionResponse> responses = result.Value
            .Select(s =>
            {
                var card = s.PublishedTrailIdentifier != null && cardByIdentifier.TryGetValue(s.PublishedTrailIdentifier, out var c) ? c : null;

                return new HikeSubmissionResponse
                {
                    Identifier = s.Identifier,
                    Name = s.Name,
                    TrailLength = s.TrailLength,
                    Status = s.Status.ToString(),
                    RejectionReason = s.RejectionReason,
                    CreatedAt = s.CreatedAt,
                    DecidedAt = s.DecidedAt,
                    SourceHikeIdentifier = s.SourceHikeIdentifier,
                    PublishedTrailIdentifier = s.PublishedTrailIdentifier,
                    LikeCount = card?.Contribution?.LikeCount ?? 0,
                    ImageUrl = card?.Image?.ImageUrl ?? (s.ImageUrl != null ? baseUrl + s.ImageUrl : null),
                };
            })
            .ToList();

        return Result.Ok(responses);
    }

    public async Task<Result> WithdrawAsync(string identifier, string userIdentifier, CancellationToken ctoken)
    {
        var userIdResult = await _userRepository.GetUserIdByIdentifierAsync(userIdentifier, ctoken);

        if (userIdResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while fetching the user."));

        if (!userIdResult.IsSuccess)
            return Result.Fail(new Message(404, "User not found"));

        var result = await _submissionRepository.WithdrawAsync(identifier, userIdResult.Value, ctoken);

        if (result.Status == RepositoryResultStatus.Conflict)
            return Result.Fail(new Message(409, "A published submission belongs to Stigvidd and cannot be withdrawn."));

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, "Submission not found"));

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while withdrawing the submission."));

        await DeleteFilesAsync(result.Value, $"Withdrawn submission {identifier}");

        return Result.Ok();
    }

    public async Task<Result<IReadOnlyCollection<AdminHikeSubmissionListItemResponse>>> ListForAdminAsync(string? status, CancellationToken ctoken)
    {
        HikeSubmissionStatus? filter = null;

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<HikeSubmissionStatus>(status, ignoreCase: true, out var parsed))
                return Result.Fail<IReadOnlyCollection<AdminHikeSubmissionListItemResponse>>(new Message(400, $"Unknown status {status}."));

            filter = parsed;
        }

        var result = await _submissionRepository.GetByStatusAsync(
            filter,
            s => new
            {
                s.Identifier,
                s.Name,
                SubmitterNickName = s.User != null ? s.User.NickName : null,
                s.ShowSubmitterName,
                s.CreatedAt,
                s.TrailLength,
                ImageCount = s.Images.Count,
                s.Status,
                s.LongestGapMetres,
            },
            ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<AdminHikeSubmissionListItemResponse>>(new Message(500, "An error occurred while fetching submissions."));

        IReadOnlyCollection<AdminHikeSubmissionListItemResponse> items = result.Value
            .Select(s => new AdminHikeSubmissionListItemResponse
            {
                Identifier = s.Identifier,
                Name = s.Name,
                SubmitterNickName = s.SubmitterNickName,
                ShowSubmitterName = s.ShowSubmitterName,
                CreatedAt = s.CreatedAt,
                TrailLength = s.TrailLength,
                ImageCount = s.ImageCount,
                Status = s.Status.ToString(),
                LongestGapMetres = Math.Round(s.LongestGapMetres, 1),
            })
            .ToList();

        return Result.Ok(items);
    }

    public async Task<Result<AdminHikeSubmissionResponse>> GetForAdminAsync(string identifier, CancellationToken ctoken)
    {
        var baseUrl = _trailResponseFactory.PresentableBaseUrl;

        var result = await _submissionRepository.GetByIdentifierAsync(
            identifier,
            s => new
            {
                s.Identifier,
                s.Name,
                s.Description,
                s.Classification,
                s.Parking,
                s.GettingThere,
                s.PublicTransport,
                s.AccessibilityInfo,
                s.City,
                s.ShowSubmitterName,
                SubmitterNickName = s.User != null ? s.User.NickName : null,
                s.TransferAcceptedAt,
                s.Status,
                s.RejectionReason,
                s.DecidedBy,
                s.DecidedAt,
                s.CreatedAt,
                s.LastUpdatedAt,
                s.TrailLength,
                s.GeoPath,
                s.OriginalGeoPath,
                PublishedTrailIdentifier = s.PublishedTrail != null ? s.PublishedTrail.Identifier : null,
                Published = s.PublishedTrail == null ? null : new
                {
                    s.PublishedTrail.Name,
                    s.PublishedTrail.Description,
                    s.PublishedTrail.Classification,
                    s.PublishedTrail.AccessibilityInfo,
                    s.PublishedTrail.City,
                    s.PublishedTrail.TrailLength,
                    s.PublishedTrail.GeoPath,
                    s.PublishedTrail.LastUpdatedAt,
                    Parking = s.PublishedTrail.VisitorInformation != null ? s.PublishedTrail.VisitorInformation.Parking : "",
                    GettingThere = s.PublishedTrail.VisitorInformation != null ? s.PublishedTrail.VisitorInformation.GettingThere : "",
                    PublicTransport = s.PublishedTrail.VisitorInformation != null ? s.PublishedTrail.VisitorInformation.PublicTransport : "",
                },
                Images = s.Images.AsQueryable()
                    .Where(HikeSubmissionRepository.IsPublishableExpression)
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new { i.Identifier, i.ImageUrl, i.Width, i.Height })
                    .ToList(),
            },
            ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<AdminHikeSubmissionResponse>(new Message(500, "An error occurred while fetching the submission."));

        if (!result.IsSuccess)
            return Result.Fail<AdminHikeSubmissionResponse>(new Message(404, "Submission not found"));

        var s = result.Value;
        // keep-comment: once published the trail is what the app shows, and the trail editor may have changed it since
        var p = s.Published;

        return Result.Ok(new AdminHikeSubmissionResponse
        {
            Identifier = s.Identifier,
            Name = p?.Name ?? s.Name,
            Description = p?.Description ?? s.Description,
            Classification = p?.Classification ?? s.Classification,
            Parking = p?.Parking ?? s.Parking,
            GettingThere = p?.GettingThere ?? s.GettingThere,
            PublicTransport = p?.PublicTransport ?? s.PublicTransport,
            AccessibilityInfo = p?.AccessibilityInfo ?? s.AccessibilityInfo,
            City = p?.City ?? s.City,
            ShowSubmitterName = s.ShowSubmitterName,
            SubmitterNickName = s.SubmitterNickName,
            TransferAcceptedAt = s.TransferAcceptedAt,
            Status = s.Status.ToString(),
            RejectionReason = s.RejectionReason,
            DecidedBy = s.DecidedBy,
            DecidedAt = s.DecidedAt,
            CreatedAt = s.CreatedAt,
            LastUpdatedAt = p?.LastUpdatedAt ?? s.LastUpdatedAt,
            TrailLength = p?.TrailLength ?? s.TrailLength,
            Coordinates = GeoPathSerializer.ToCoordinateJson(p?.GeoPath ?? s.GeoPath),
            OriginalCoordinates = GeoPathSerializer.ToCoordinateJson(s.OriginalGeoPath),
            PublishedTrailIdentifier = s.PublishedTrailIdentifier,
            Images = s.Images
                .Select(i => new HikeSubmissionImageResponse
                {
                    Identifier = i.Identifier,
                    ImageUrl = baseUrl + i.ImageUrl,
                    Width = i.Width,
                    Height = i.Height,
                })
                .ToList(),
        });
    }

    public async Task<Result<AdminHikeSubmissionResponse>> UpdateAsync(string identifier, UpdateHikeSubmissionRequest request, CancellationToken ctoken)
    {
        var result = await _submissionRepository.UpdateDetailsAsync(
            identifier,
            request.Name.Trim(),
            request.Description.Trim(),
            request.Classification,
            request.Parking?.Trim() ?? string.Empty,
            request.GettingThere.Trim(),
            request.PublicTransport?.Trim() ?? string.Empty,
            request.AccessibilityInfo?.Trim() ?? string.Empty,
            request.City.Trim(),
            request.LastUpdatedAt,
            ctoken);

        var failure = ToFailure(result.Status, identifier);

        return failure is null
            ? await GetForAdminAsync(identifier, ctoken)
            : Result.Fail<AdminHikeSubmissionResponse>(failure);
    }

    public async Task<Result<AdminHikeSubmissionResponse>> UpdateGeometryAsync(string identifier, UpdateHikeSubmissionGeometryRequest request, CancellationToken ctoken)
    {
        var path = CoordinatePathParser.TryParse(request.Coordinates);

        if (path is null)
            return Result.Fail<AdminHikeSubmissionResponse>(new Message(400, "The coordinates are invalid."));

        var result = await _submissionRepository.UpdateGeometryAsync(
            identifier, path, PathMetrics.LengthKm(path), PathMetrics.LongestGapMetres(path), ctoken);
        var failure = ToFailure(result.Status, identifier);

        return failure is null
            ? await GetForAdminAsync(identifier, ctoken)
            : Result.Fail<AdminHikeSubmissionResponse>(failure);
    }

    public async Task<Result> DeleteImageAsync(string identifier, string imageIdentifier, CancellationToken ctoken)
    {
        var result = await _submissionRepository.DeleteImageAsync(identifier, imageIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.NotFound)
            return Result.Fail(new Message(404, "Image not found"));

        if (!result.IsSuccess)
            return Result.Fail(new Message(500, "An error occurred while deleting the image."));

        await DeleteFilesAsync([result.Value], $"Submission {identifier}, image {imageIdentifier}");

        return Result.Ok();
    }

    public async Task<Result<string>> ApproveAsync(string identifier, string decidedBy, CancellationToken ctoken)
    {
        var result = await _submissionRepository.ApproveAsync(identifier, decidedBy, _placeholderImagePaths, ctoken);
        var failure = ToFailure(result.Status, identifier);

        if (failure is not null || !result.IsSuccess)
            return Result.Fail<string>(failure ?? new Message(500, "An error occurred while approving the submission."));

        await DeleteFilesAsync(result.Value.DiscardedImageUrls, $"Approved submission {identifier}, photos hidden on the hike");

        return Result.Ok(result.Value.TrailIdentifier);
    }

    public async Task<Result> RejectAsync(string identifier, RejectHikeSubmissionRequest request, string decidedBy, CancellationToken ctoken)
    {
        var result = await _submissionRepository.RejectAsync(identifier, request.Reason.Trim(), decidedBy, ctoken);
        var failure = ToFailure(result.Status, identifier);

        if (failure is not null || !result.IsSuccess)
            return Result.Fail(failure ?? new Message(500, "An error occurred while rejecting the submission."));

        await DeleteFilesAsync(result.Value, $"Rejected submission {identifier}");

        return Result.Ok();
    }

    public async Task<Result<IReadOnlyCollection<SimilarTrailResponse>>> GetSimilarRoutesAsync(string identifier, CancellationToken ctoken)
    {
        var walkResult = await _submissionRepository.GetByIdentifierAsync(
            identifier,
            s => new { s.GeoPath, Published = s.PublishedTrail != null ? s.PublishedTrail.GeoPath : null },
            ctoken);

        if (walkResult.Status == RepositoryResultStatus.Error)
            return Result.Fail<IReadOnlyCollection<SimilarTrailResponse>>(new Message(500, "An error occurred while fetching the submission."));

        if (!walkResult.IsSuccess)
            return Result.Fail<IReadOnlyCollection<SimilarTrailResponse>>(new Message(404, "Submission not found"));

        if ((walkResult.Value.Published ?? walkResult.Value.GeoPath) is not { } walk)
            return Result.Ok<IReadOnlyCollection<SimilarTrailResponse>>([]);

        var routes = await _submissionRepository.GetComparableRoutesAsync(identifier, ctoken);

        if (!routes.IsSuccess)
            return Result.Fail<IReadOnlyCollection<SimilarTrailResponse>>(new Message(500, "An error occurred while fetching the trails to compare with."));

        return Result.Ok(RankSimilar(walk, routes.Value));
    }

    // keep-comment: wider than the import's 15 m, since a phone's GPS wanders further than a drawn trail
    internal const double SimilarToleranceMetres = 25;
    internal const double SimilarMinimumShare = 0.3;
    internal const double DuplicateShare = 0.8;
    private const int MaxSimilar = 5;
    private const double NearbySlackDegrees = 0.005;

    internal static IReadOnlyCollection<SimilarTrailResponse> RankSimilar(LineString walk, IEnumerable<RoutePath> routes)
    {
        var box = walk.EnvelopeInternal.Copy();
        box.ExpandBy(NearbySlackDegrees);

        return routes
            .Where(r => box.Intersects(r.GeoPath.EnvelopeInternal))
            .Select(r => (Route: r, Comparison: GeometryComparison.Compare(walk, r.GeoPath, SimilarToleranceMetres)))
            .Where(x => Math.Max(x.Comparison.CoverageForward, x.Comparison.CoverageBackward) >= SimilarMinimumShare)
            .OrderByDescending(x => Math.Min(x.Comparison.CoverageForward, x.Comparison.CoverageBackward))
            .ThenByDescending(x => x.Comparison.CoverageForward)
            .Take(MaxSimilar)
            .Select(x => new SimilarTrailResponse
            {
                Identifier = x.Route.Identifier,
                Name = x.Route.Name,
                Kind = x.Route.Kind.ToString(),
                WalkOnRoute = Math.Round(x.Comparison.CoverageForward, 2),
                RouteOnWalk = Math.Round(x.Comparison.CoverageBackward, 2),
                LikelyDuplicate = Math.Min(x.Comparison.CoverageForward, x.Comparison.CoverageBackward) >= DuplicateShare,
            })
            .ToList();
    }

    // keep-comment: a null index keeps that end as recorded; both are inclusive and must leave at least two points
    internal static LineString? Trim(LineString path, int? startIndex, int? endIndex)
    {
        var coordinates = path.Coordinates;
        var start = startIndex ?? 0;
        var end = endIndex ?? coordinates.Length - 1;

        if (start < 0 || end >= coordinates.Length || end - start < 1)
            return null;

        return GeoPointFactory.FromLonLatPath(coordinates[start..(end + 1)].Select(c => new Coordinate(c.X, c.Y)));
    }

    private static Message? ToFailure(RepositoryResultStatus status, string identifier) => status switch
    {
        RepositoryResultStatus.Success => null,
        RepositoryResultStatus.NotFound => new Message(404, $"Submission {identifier} not found."),
        RepositoryResultStatus.Conflict => new Message(409, "The submission has been decided or changed elsewhere. Reload it and try again."),
        _ => new Message(500, "An error occurred while updating the submission."),
    };

    private async Task<HikeSubmissionImage?> CopyImageAsync(HikeImage source)
    {
        var sourceUrl = source.ImageUrl;

        try
        {
            var download = await _webDavService.DownloadAsync(sourceUrl);

            if (download.IsFailure || download.Value is null)
                return null;

            await using var stream = download.Value;
            var upload = await _mediaUploadService.ProcessAndUploadAsync(stream, "trails", ImageProcessingOptions.StripMetadataOnly);

            if (upload.IsFailure || upload.Value is null)
                return null;

            return new HikeSubmissionImage
            {
                SourceHikeImageId = source.Id,
                ImageUrl = upload.Value.Path,
                Width = upload.Value.Width,
                Height = upload.Value.Height,
                SizeBytes = upload.Value.SizeBytes,
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "HikeSubmissionService: could not copy hike image {Url}.", sourceUrl);
            return null;
        }
    }

    // keep-comment: best-effort like HikeService: a leftover file is recoverable, a failed request after the rows changed is not
    private async Task DeleteFilesAsync(IEnumerable<string> urls, string context, [CallerMemberName] string operation = "")
    {
        foreach (var url in urls)
        {
            try
            {
                var result = await _webDavService.DeleteFileAsync(url);

                if (result.IsFailure)
                    _logger.LogError("{Operation}: WebDAV refused to delete submission image {Url}. {Context}", operation, url, context);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "{Operation}: Failed to delete submission image {Url}. {Context}", operation, url, context);
            }
        }
    }
}
