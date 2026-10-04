// SPDX-FileCopyrightText: 2025-2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using WebDataContracts.ResponseModels.Admin;

namespace IntegrationTests.Admin;

public class AdminDashboardControllerIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private const string DashboardRoute = "/api/v1/admin/dashboard";

    private readonly StigViddWebApplicationFactory<Program> _factory;

    public AdminDashboardControllerIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient CreateAdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "keycloak-sub-with-no-user-row");
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    [Fact]
    public async Task GetDashboard_WithAdminRole_ReturnsCountsAndTheLatestReviewsNewestFirst()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var dashboard = await client.GetFromJsonAsync<AdminDashboardResponse>(DashboardRoute, TestContext.Current.CancellationToken);

        // Assert
        dashboard.Should().NotBeNull();
        dashboard.UserCount.Should().BeGreaterThan(0);
        dashboard.ReviewCount.Should().BeGreaterThan(0);
        dashboard.NewUsersLast7Days.Should().BeLessThanOrEqualTo(dashboard.UserCount);
        dashboard.ReviewsLast7Days.Should().BeLessThanOrEqualTo(dashboard.ReviewCount);

        dashboard.LatestReviews.Should().NotBeEmpty().And.HaveCountLessThanOrEqualTo(5);
        dashboard.LatestReviews.Should().BeInDescendingOrder(r => r.CreatedAt);
        dashboard.LatestReviews.Should().AllSatisfy(r =>
        {
            r.TrailIdentifier.Should().NotBeNullOrWhiteSpace();
            r.TrailName.Should().NotBeNullOrWhiteSpace();
        });
        dashboard.LatestReviews.Should().Contain(r => r.ImageCount > 0 && r.AuthorNickName != null);
    }

    [Fact]
    public async Task GetDashboard_WithoutTheAdminRole_IsForbidden()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "firebase-uid-12346");

        // Act
        var response = await client.GetAsync(DashboardRoute, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
