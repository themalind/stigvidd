// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Infrastructure.Enums;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebDataContracts.RequestModels.Facility;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Services.Facilities;

public class FacilityService : IFacilityService
{
    private readonly IFacilityRepository _facilityRepository;
    private readonly FacilityResponseFactory _facilityResponseFactory;
    private readonly IMediaUploadService _mediaUploadService;
    private readonly IWebDavService _webDavService;
    private readonly ILogger<FacilityService> _logger;
    private readonly ICityAreaMembershipService _cityAreaMembership;
    private readonly string _presentableBaseUrl;

    public FacilityService(
        IFacilityRepository facilityRepository,
        FacilityResponseFactory facilityResponseFactory,
        IMediaUploadService mediaUploadService,
        IWebDavService webDavService,
        ILogger<FacilityService> logger,
        IConfiguration configuration,
        ICityAreaMembershipService cityAreaMembership)
    {
        _facilityRepository = facilityRepository;
        _cityAreaMembership = cityAreaMembership;
        _facilityResponseFactory = facilityResponseFactory;
        _mediaUploadService = mediaUploadService;
        _webDavService = webDavService;
        _logger = logger;
        _presentableBaseUrl = configuration["PresentableBaseUrl"]
            ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public async Task<Result<AdminFacilityResponse>> CreateFacilityAsync(SaveFacilityRequest request, CancellationToken ctoken)
    {
        var facility = new Facility { Name = string.Empty };
        Apply(facility, request);

        var result = await _facilityRepository.CreateFacilityAsync(facility, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<AdminFacilityResponse>(new Message(500, "Failed to create the facility."));

        await _cityAreaMembership.FacilitiesMovedAsync([result.Value.Id], ctoken);

        return Result.Ok(_facilityResponseFactory.CreateAdmin(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<FacilityResponse>>> GetAllAsync(CancellationToken ctoken)
    {
        var result = await _facilityRepository.GetAllAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<FacilityResponse>>(new Message(500, "An error occurred while retrieving facilities."));

        return Result.Ok(_facilityResponseFactory.Create(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<AdminFacilityResponse>>> GetAllIncludingUnmappedAsync(CancellationToken ctoken)
    {
        var result = await _facilityRepository.GetAllIncludingUnmappedAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<AdminFacilityResponse>>(new Message(500, "An error occurred while retrieving facilities."));

        return Result.Ok<IReadOnlyCollection<AdminFacilityResponse>>([.. result.Value.Select(_facilityResponseFactory.CreateAdmin)]);
    }

    public async Task<Result<FacilityResponse>> GetByIdentifierAsync(string identifier, CancellationToken ctoken)
    {
        var result = await _facilityRepository.GetByIdentifierAsync(identifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail<FacilityResponse>(new Message(500, "An error occurred while retrieving the facility."));

        if (!result.IsSuccess)
            return Result.Fail<FacilityResponse>(new Message(404, $"No facility found with identifier: {identifier}"));

        return Result.Ok(_facilityResponseFactory.Create(result.Value));
    }

    public async Task<Result<AdminFacilityResponse>> UpdateFacilityAsync(string facilityIdentifier, SaveFacilityRequest request, CancellationToken ctoken)
    {
        var facility = await _facilityRepository.GetByIdentifierAsync(facilityIdentifier, ctoken);

        if (facility.Status == RepositoryResultStatus.Error)
            return Result.Fail<AdminFacilityResponse>(new Message(500, "An error occurred while retrieving the facility."));

        if (!facility.IsSuccess)
            return Result.Fail<AdminFacilityResponse>(new Message(404, $"No facility found with identifier: {facilityIdentifier}"));

        var existingFacility = facility.Value;
        Apply(existingFacility, request);

        var updateResult = await _facilityRepository.UpdateAsync(existingFacility, ctoken);

        if (!updateResult.IsSuccess)
            return Result.Fail<AdminFacilityResponse>(new Message(500, "Failed to update the facility."));

        await _cityAreaMembership.FacilitiesMovedAsync([updateResult.Value.Id], ctoken);

        return Result.Ok(_facilityResponseFactory.CreateAdmin(updateResult.Value));
    }

    private static void Apply(Facility facility, SaveFacilityRequest request)
    {
        facility.Name = request.Name.Trim();
        facility.FacilityType = MapToFacilityType(request.FacilityType);
        facility.IsAccessible = request.IsAccessible;
        facility.Coordinates = GeoPointFactory.FromLonLat(request.Longitude, request.Latitude);
        facility.Location = OrNull(request.Location);
        facility.Description = OrNull(request.Description);
        facility.Url = OrNull(request.Url);
    }

    private static string? OrNull(string value)
    {
        var trimmed = value.Trim();
        return trimmed.Length == 0 ? null : trimmed;
    }

    public async Task<Result> DeleteAsync(string facilityIdentifier, CancellationToken ctoken)
    {
        var facilityResult = await _facilityRepository.GetByIdentifierAsync(facilityIdentifier, ctoken);

        if (facilityResult.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while retrieving the facility."));

        if (!facilityResult.IsSuccess)
            return Result.Fail(new Message(404, $"No facility found with identifier: {facilityIdentifier}"));

        var deleteResult = await _facilityRepository.DeleteAsync(facilityResult.Value, ctoken);

        if (!deleteResult.IsSuccess)
            return Result.Fail(new Message(500, "Failed to delete the facility."));

        return Result.Ok();
    }

    public async Task<Result<IReadOnlyCollection<FacilityImageResponse>>> AddFacilityImagesAsync(
        string facilityIdentifier,
        IFormFileCollection images,
        ImageProcessingOptions options,
        CancellationToken ctoken)
    {
        var uploadedUrls = new List<string>();

        try
        {
            var facilityResult = await _facilityRepository.GetByIdentifierAsync(facilityIdentifier, ctoken);

            if (facilityResult.Status == RepositoryResultStatus.Error)
                return Result.Fail<IReadOnlyCollection<FacilityImageResponse>>(new Message(500, "An error occurred while fetching the facility."));

            if (!facilityResult.IsSuccess)
                return Result.Fail<IReadOnlyCollection<FacilityImageResponse>>(new Message(404, $"No facility found with identifier: {facilityIdentifier}"));

            var facilityImages = new List<FacilityImage>();

            foreach (var image in images)
            {
                var uploadResult = await _mediaUploadService.ProcessAndUploadAsync(image.OpenReadStream(), "facilities", options);

                if (uploadResult.IsFailure || uploadResult.Value == null)
                    return Result.Fail<IReadOnlyCollection<FacilityImageResponse>>(new Message(500, "Something went wrong uploading images. Try again later."));

                uploadedUrls.Add(uploadResult.Value.Path);
                facilityImages.Add(new FacilityImage
                {
                    ImageUrl = uploadResult.Value.Path,
                    Width = uploadResult.Value.Width,
                    Height = uploadResult.Value.Height,
                    SizeBytes = uploadResult.Value.SizeBytes
                });
            }

            var addResult = await _facilityRepository.AddFacilityImagesAsync(facilityResult.Value.Id, facilityImages, ctoken);

            if (!addResult.IsSuccess)
                return Result.Fail<IReadOnlyCollection<FacilityImageResponse>>(new Message(500, "An error occurred while saving images."));

            IReadOnlyCollection<FacilityImageResponse> response = addResult.Value
                .Select(img => FacilityImageResponse.Create(
                    _presentableBaseUrl, img.Identifier, img.ImageUrl,
                    img.AltText, img.Caption, img.Width, img.Height, img.SizeBytes))
                .ToList();

            return Result.Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "FacilityService: AddFacilityImagesAsync -> Error adding images to facility {FacilityIdentifier}", facilityIdentifier);

            foreach (var url in uploadedUrls)
            {
                try { await _webDavService.DeleteFileAsync(url); }
                catch (Exception cleanupEx) { _logger.LogWarning(cleanupEx, "Failed to cleanup uploaded image: {Url}", url); }
            }

            return Result.Fail<IReadOnlyCollection<FacilityImageResponse>>(new Message(500, "An error occurred while adding images."));
        }
    }

    public async Task<Result> DeleteFacilityImageAsync(string imageIdentifier, CancellationToken ctoken)
    {
        var result = await _facilityRepository.DeleteFacilityImageAsync(imageIdentifier, ctoken);

        if (result.Status == RepositoryResultStatus.Error)
            return Result.Fail(new Message(500, "An error occurred while deleting the image."));

        if (!result.IsSuccess)
            return Result.Fail(new Message(404, $"Image with identifier {imageIdentifier} not found."));

        return Result.Ok();
    }

    private static FacilityType MapToFacilityType(int facilityType)
    {
        return FacilityTypes.IsKnown(facilityType) ? (FacilityType)facilityType : FacilityType.None;
    }
}
