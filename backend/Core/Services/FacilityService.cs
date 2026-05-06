using Core.Factories;
using Core.Interfaces.Repositories;
using Core.Interfaces.Services;
using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Facility;

namespace Core.Services;

public class FacilityService : IFacilityService
{
    private readonly IFacilityRepository _facilityRepository;
    private readonly FacilityResponseFactory _facilityResponseFactory;

    public FacilityService(IFacilityRepository facilityRepository, FacilityResponseFactory facilityResponseFactory)
    {
        _facilityRepository = facilityRepository;
        _facilityResponseFactory = facilityResponseFactory;
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
