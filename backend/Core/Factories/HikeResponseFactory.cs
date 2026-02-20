using Infrastructure.Data.Entities;
using WebDataContracts.ResponseModels.Hike;
using WebDataContracts.ResponseModels.Review;

namespace Core.Factories;

public class HikeResponseFactory
{
    public HikeResponse Create(Hike hike)
    {
        return HikeResponse.Create(
            hike.Identifier,
            hike.Name,
            hike.HikeLength,
            hike.Duration,
            hike.Coordinates,
            hike.CreatedBy
        );
    }
}