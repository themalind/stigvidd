using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Services;

public class FacilityService : IFacilityService
{
    private readonly IFacilityRepository _facilityRepository;
    private readonly FacilityResponseFactory _facilityResponseFactory;
    private readonly IMediaUploadService _mediaUploadService;
    private readonly IWebDavService _webDavService;
    private readonly ILogger<FacilityService> _logger;
    private readonly string _presentableBaseUrl;

    public FacilityService(
        IFacilityRepository facilityRepository,
        FacilityResponseFactory facilityResponseFactory,
        IMediaUploadService mediaUploadService,
        IWebDavService webDavService,
        ILogger<FacilityService> logger,
        IConfiguration configuration)
    {
        _facilityRepository = facilityRepository;
        _facilityResponseFactory = facilityResponseFactory;
        _mediaUploadService = mediaUploadService;
        _webDavService = webDavService;
        _logger = logger;
        _presentableBaseUrl = configuration["PresentableBaseUrl"]
            ?? throw new InvalidOperationException("PresentableBaseUrl configuration is missing");
    }

    public async Task<Result<FacilityResponse>> CreateFacilityAsync(
        string name,
        int facilityType,
        bool IsAccessible,
        decimal longitude,
        decimal latitude,
        CancellationToken ctoken)
    {
        var facility = new Facility
        {
            Name = name,
            FacilityType = MapToFacilityType(facilityType),
            IsAccessible = IsAccessible,
            Longitude = longitude,
            Latitude = latitude
        };

        var result = await _facilityRepository.CreateFacilityAsync(facility, ctoken);

        if (!result.IsSuccess)
            return Result.Fail<FacilityResponse>(new Message(500, "Failed to create the facility."));

        return Result.Ok(_facilityResponseFactory.Create(result.Value));
    }

    public async Task<Result<IReadOnlyCollection<FacilityResponse>>> GetAllAsync(CancellationToken ctoken)
    {
        var result = await _facilityRepository.GetAllAsync(ctoken);

        if (!result.IsSuccess)
            return Result.Fail<IReadOnlyCollection<FacilityResponse>>(new Message(500, "An error occurred while retrieving facilities."));

        return Result.Ok(_facilityResponseFactory.Create(result.Value));
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

    public async Task<Result<FacilityResponse>> UpdateFacilityAsync(string facilityIdentifier, string? name, int? facilityType, bool? isAccessible, decimal? longitude, decimal? latitude, CancellationToken ctoken)
    {
        var facility = await _facilityRepository.GetByIdentifierAsync(facilityIdentifier, ctoken);

        if (facility.Status == RepositoryResultStatus.Error)
            return Result.Fail<FacilityResponse>(new Message(500, "An error occurred while retrieving the facility."));

        if (!facility.IsSuccess)
            return Result.Fail<FacilityResponse>(new Message(404, $"No facility found with identifier: {facilityIdentifier}"));

        var existingFacility = facility.Value;

        existingFacility.Name = name ?? existingFacility.Name;
        existingFacility.FacilityType = facilityType.HasValue ? MapToFacilityType(facilityType.Value) : existingFacility.FacilityType;
        existingFacility.IsAccessible = isAccessible ?? existingFacility.IsAccessible;
        existingFacility.Longitude = longitude ?? existingFacility.Longitude;
        existingFacility.Latitude = latitude ?? existingFacility.Latitude;

        var updateResult = await _facilityRepository.UpdateAsync(existingFacility, ctoken);

        if (!updateResult.IsSuccess)
            return Result.Fail<FacilityResponse>(new Message(500, "Failed to update the facility."));

        return Result.Ok(_facilityResponseFactory.Create(updateResult.Value));
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

    private FacilityType MapToFacilityType(int facilityType)
    {
        return facilityType switch
        {
            1 => FacilityType.FirePit,
            2 => FacilityType.Shelter,
            3 => FacilityType.FirePit | FacilityType.Shelter,
            _ => FacilityType.None,
        };
    }
}
