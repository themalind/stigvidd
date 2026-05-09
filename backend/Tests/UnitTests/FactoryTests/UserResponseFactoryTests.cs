using Core.Factories;
using FluentAssertions;
using Infrastructure.Data.Entities;
using Microsoft.Extensions.Configuration;
using Moq;

namespace UnitTests.FactoryTests;

public class UserResponseFactoryTests
{
    private static UserResponseFactory BuildFactory()
    {
        var cfg = new Mock<IConfiguration>();
        cfg.Setup(c => c["PresentableBaseUrl"]).Returns("http://stigvidd.se/testing/");
        return new UserResponseFactory(cfg.Object);
    }

    private static User BaseUser() => new()
    {
        Identifier = "user-id",
        NickName = "Nick",
        Email = "nick@test.com",
        FirebaseUid = "uid",
        MyWishList = null,
        MyFavorites = null
    };

    [Fact]
    public void Create_WhenWishlistHasTrailImages_ImageUrlsHaveBaseUrlPrepended()
    {
        // Arrange
        var factory = BuildFactory();
        var user = BaseUser();
        user.MyWishList =
        [
            new Trail
            {
                Identifier = "trail-id", Name = "Trail", TrailLength = 5M,
                TrailImages = [new TrailImage { Identifier = "img-1", ImageUrl = "trails/img.jpg", TrailId = 1 }]
            }
        ];

        // Act
        var result = factory.Create(user);

        // Assert
        result.MyWishList.Should().HaveCount(1);
        result.MyWishList.Should().NotBeNull();
        result.MyWishList.First().TrailImages.Should().NotBeNull();
        result.MyWishList.First().TrailImages.Should().AllSatisfy(img =>
            img.ImageUrl.Should().StartWith("http://stigvidd.se/testing/"));
    }

    [Fact]
    public void Create_WhenFavoritesHasTrailImages_ImageUrlsHaveBaseUrlPrepended()
    {
        // Arrange
        var factory = BuildFactory();
        var user = BaseUser();
        user.MyFavorites =
        [
            new Trail
            {
                Identifier = "trail-id", Name = "Trail", TrailLength = 5M,
                TrailImages = [new TrailImage { Identifier = "img-1", ImageUrl = "trails/img.jpg", TrailId = 1 }]
            }
        ];

        // Act
        var result = factory.Create(user);

        // Assert
        result.MyFavorites.Should().HaveCount(1);
        result.MyFavorites.Should().NotBeNull();
        result.MyFavorites.First().TrailImages.Should().NotBeNull();
        result.MyFavorites.First().TrailImages.Should().AllSatisfy(img =>
            img.ImageUrl.Should().StartWith("http://stigvidd.se/testing/"));
    }

    [Fact]
    public void Create_WhenWishlistIsNull_ReturnsNullWishlist()
    {
        // Arrange
        var factory = BuildFactory();
        var user = BaseUser();
        user.MyWishList = null;

        // Act
        var result = factory.Create(user);

        // Assert
        result.MyWishList.Should().BeNull();
    }

    [Fact]
    public void Create_WhenFavoritesIsNull_ReturnsNullFavorites()
    {
        // Arrange
        var factory = BuildFactory();
        var user = BaseUser();
        user.MyFavorites = null;

        // Act
        var result = factory.Create(user);

        // Assert
        result.MyFavorites.Should().BeNull();
    }
}
