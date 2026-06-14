using Core.Repositories;
using FluentAssertions;
using Infrastructure.Data;
using Infrastructure.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace UnitTests.RepositoryTests;

public class UserPushTokenRepositoryTests : TestBase
{
    private const string ExistingToken = "ExponentPushToken[existing-token]";
    private const int ExistingUserId = 1;

    private static IDbContextFactory<StigViddDbContext> CreateSeededFactoryWithTokens() =>
        CreateSeededFactory(ctx => ctx.UserPushTokens.Add(
            new UserPushToken { UserId = ExistingUserId, ExpoToken = ExistingToken, Platform = "android" }));

    private static UserPushTokenRepository BuildRepo(IDbContextFactory<StigViddDbContext>? factory = null) =>
        new(factory ?? CreateSeededFactory(), NullLogger<UserPushTokenRepository>.Instance);

    [Fact]
    public async Task GetByTokenAndUserAsync_WhenFound_ReturnsSuccessWithToken()
    {
        var repo = BuildRepo(CreateSeededFactoryWithTokens());

        var result = await repo.GetByTokenAndUserAsync(ExistingToken, ExistingUserId, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value.ExpoToken.Should().Be(ExistingToken);
    }

    [Fact]
    public async Task GetByTokenAndUserAsync_WhenTokenNotFound_ReturnsSuccessWithNull()
    {
        var repo = BuildRepo(CreateSeededFactoryWithTokens());

        var result = await repo.GetByTokenAndUserAsync("nonexistent-token", ExistingUserId, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task GetByTokenAndUserAsync_WhenTokenBelongsToDifferentUser_ReturnsSuccessWithNull()
    {
        var repo = BuildRepo(CreateSeededFactoryWithTokens());

        var result = await repo.GetByTokenAndUserAsync(ExistingToken, 999, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeNull();
    }

    [Fact]
    public async Task GetTokensForUserAsync_WhenUserHasTokens_ReturnsNonEmptyList()
    {
        var repo = BuildRepo(CreateSeededFactoryWithTokens());

        var result = await repo.GetTokensForUserAsync(ExistingUserId, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetTokensForUserAsync_WhenUserHasNoTokens_ReturnsEmptyList()
    {
        var repo = BuildRepo(CreateSeededFactoryWithTokens());

        var result = await repo.GetTokensForUserAsync(999, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().BeEmpty();
    }

    [Fact]
    public async Task UpsertAsync_WhenTokenDoesNotExist_InsertsToken()
    {
        const string newToken = "ExponentPushToken[new-token]";
        var repo = BuildRepo(CreateSeededFactory());

        var result = await repo.UpsertAsync(ExistingUserId, newToken, "android", CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        var verify = await repo.GetByTokenAndUserAsync(newToken, ExistingUserId, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().NotBeNull();
        verify.Value.Platform.Should().Be("android");
    }

    [Fact]
    public async Task UpsertAsync_WhenTokenAlreadyExists_UpdatesPlatform()
    {
        var repo = BuildRepo(CreateSeededFactoryWithTokens());

        var result = await repo.UpsertAsync(ExistingUserId, ExistingToken, "android", CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        var verify = await repo.GetByTokenAndUserAsync(ExistingToken, ExistingUserId, CancellationToken.None);
        verify.IsSuccess.Should().BeTrue();
        verify.Value.Should().NotBeNull();
        verify.Value.Platform.Should().Be("android");
    }

    [Fact]
    public async Task DeleteByTokenAsync_WhenFound_ReturnsSuccess()
    {
        var repo = BuildRepo(CreateSeededFactoryWithTokens());

        var result = await repo.DeleteByTokenAsync(ExistingToken, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteByTokenAsync_WhenNotFound_ReturnsError()
    {
        var repo = BuildRepo(CreateSeededFactoryWithTokens());

        var result = await repo.DeleteByTokenAsync("nonexistent-token", CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
    }
}
