// SPDX-FileCopyrightText: 2026 The Stigvidd Authors
// SPDX-License-Identifier: AGPL-3.0-or-later

using AwesomeAssertions;
using StigviddAPI;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using WebDataContracts.RequestModels.CityArea;
using WebDataContracts.ResponseModels.CityArea;

namespace IntegrationTests.Admin;

public class AdminCityAreaBoundaryIntegrationTests : IClassFixture<StigViddWebApplicationFactory<Program>>
{
    private readonly StigViddWebApplicationFactory<Program> _factory;

    private const string Route = "/api/v1/admin/city-areas";
    private const string AuthenticatedUser = "firebase-uid-12346";
    private const string EmptyArea = "area-viskafors";
    private const string Tiveden = "11a1b2c3-d4e5-4f6a-7b8c-9d0e1f2a3b4c";
    private const string Firepit = "fac1a1b2-c3d4-4e5f-6a7b-8c9d0e1f2a3b";

    public AdminCityAreaBoundaryIntegrationTests(StigViddWebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _factory.SeedDatabase();
    }

    private HttpClient CreateAdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", AuthenticatedUser);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, TestAuthHandler.AdminRole);
        return client;
    }

    // keep-comment: a box around the seeded Tiveden trail, well away from the seeded fire pit at 14.5, 58.9
    private static SaveCityAreaBoundaryRequest AroundTiveden()
    {
        List<List<double>> ring = [[12.80, 57.61], [12.82, 57.61], [12.82, 57.63], [12.80, 57.63], [12.80, 57.61]];

        return new SaveCityAreaBoundaryRequest { Coordinates = [[ring]] };
    }

    private async Task<AdminCityAreaResponse> GetAreaAsync(HttpClient client, string identifier)
    {
        var areas = await client.GetFromJsonAsync<List<AdminCityAreaResponse>>(Route, TestContext.Current.CancellationToken);
        areas.Should().NotBeNull();
        var area = areas.SingleOrDefault(a => a.Identifier == identifier);
        area.Should().NotBeNull();
        return area;
    }

    [Fact]
    public async Task SaveBoundary_LinksTheTrailInside_AndRemovingItUnlinksIt()
    {
        // Arrange
        var client = CreateAdminClient();
        var ct = TestContext.Current.CancellationToken;

        // Act
        var saved = await client.PutAsJsonAsync($"{Route}/{EmptyArea}/boundary", AroundTiveden(), ct);
        var drawn = await GetAreaAsync(client, EmptyArea);
        var removed = await client.DeleteAsync($"{Route}/{EmptyArea}/boundary", ct);
        var cleared = await GetAreaAsync(client, EmptyArea);

        // Assert
        saved.StatusCode.Should().Be(HttpStatusCode.NoContent);
        if (drawn.Boundary is not { } boundary) throw new InvalidOperationException("expected a boundary");
        boundary[0][0][1].Should().Equal(12.82, 57.61);
        drawn.Trails.Should().Contain(t => t.Identifier == Tiveden && !t.IsManual);
        drawn.Facilities.Should().NotContain(f => f.Identifier == Firepit);
        removed.StatusCode.Should().Be(HttpStatusCode.NoContent);
        cleared.Boundary.Should().BeNull();
        cleared.Trails.Should().BeEmpty();
    }

    [Fact]
    public async Task UnlinkingABoundaryTrail_ListsItAsExcluded_AndUndoBringsItBack()
    {
        // Arrange
        var client = CreateAdminClient();
        var ct = TestContext.Current.CancellationToken;
        await client.PutAsJsonAsync($"{Route}/{EmptyArea}/boundary", AroundTiveden(), ct);

        // Act
        var unlinked = await client.DeleteAsync($"{Route}/{EmptyArea}/trails/{Tiveden}", ct);
        var excluded = await GetAreaAsync(client, EmptyArea);
        var undone = await client.DeleteAsync($"{Route}/{EmptyArea}/excluded-trails/{Tiveden}", ct);
        var restored = await GetAreaAsync(client, EmptyArea);

        // Assert
        unlinked.StatusCode.Should().Be(HttpStatusCode.NoContent);
        excluded.Trails.Should().NotContain(t => t.Identifier == Tiveden);
        excluded.ExcludedTrails.Should().ContainSingle().Which.Identifier.Should().Be(Tiveden);
        undone.StatusCode.Should().Be(HttpStatusCode.NoContent);
        restored.Trails.Should().Contain(t => t.Identifier == Tiveden);
        restored.ExcludedTrails.Should().BeEmpty();
    }

    [Fact]
    public async Task Recalculate_CountsTheAreasWithABoundary()
    {
        // Arrange
        var client = CreateAdminClient();
        var ct = TestContext.Current.CancellationToken;
        await client.PutAsJsonAsync($"{Route}/{EmptyArea}/boundary", AroundTiveden(), ct);

        // Act
        var response = await client.PostAsync($"{Route}/recalculate", null, ct);
        var body = await response.Content.ReadFromJsonAsync<AdminCityAreaRecalculationResponse>(ct);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        body.Should().NotBeNull();
        body.AreaCount.Should().Be(1);
    }

    [Fact]
    public async Task SaveBoundary_ThatCrossesItself_ReturnsBadRequest()
    {
        // Arrange
        var client = CreateAdminClient();
        List<List<double>> bowTie = [[12.80, 57.61], [12.82, 57.63], [12.82, 57.61], [12.80, 57.63], [12.80, 57.61]];

        // Act
        var response = await client.PutAsJsonAsync(
            $"{Route}/{EmptyArea}/boundary", new SaveCityAreaBoundaryRequest { Coordinates = [[bowTie]] }, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SaveBoundary_WithAnOpenRing_ReturnsBadRequest()
    {
        // Arrange
        var client = CreateAdminClient();
        List<List<double>> open = [[12.80, 57.61], [12.82, 57.61], [12.82, 57.63], [12.80, 57.63]];

        // Act
        var response = await client.PutAsJsonAsync(
            $"{Route}/{EmptyArea}/boundary", new SaveCityAreaBoundaryRequest { Coordinates = [[open]] }, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SuggestBoundary_ForAnAreaWithoutLinks_ReturnsCodedNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.GetAsync($"{Route}/{EmptyArea}/boundary-suggestion", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        body.GetProperty("code").GetString().Should().Be("no_boundary_sources");
    }

    [Fact]
    public async Task GetTrailPaths_ReturnsThePathOfALinkedTrail_InLongitudeLatitudeOrder()
    {
        // Arrange
        var client = CreateAdminClient();
        var ct = TestContext.Current.CancellationToken;
        await client.PutAsync($"{Route}/{EmptyArea}/trails/{Tiveden}", null, ct);

        // Act
        var paths = await client.GetFromJsonAsync<List<AdminCityAreaTrailPathResponse>>($"{Route}/{EmptyArea}/trail-paths", ct);

        // Assert
        paths.Should().NotBeNull();
        var trail = paths.Should().ContainSingle().Subject;
        trail.Identifier.Should().Be(Tiveden);
        trail.Path.Should().NotBeEmpty();
        trail.Path[0][0].Should().BeInRange(12.80, 12.82);
        trail.Path[0][1].Should().BeInRange(57.61, 57.63);
    }

    [Fact]
    public async Task PreviewBoundary_ListsTheTrailItWouldTakeIn_WithoutSaving()
    {
        // Arrange
        var client = CreateAdminClient();
        var ct = TestContext.Current.CancellationToken;

        // Act
        var response = await client.PostAsJsonAsync($"{Route}/{EmptyArea}/boundary-preview", AroundTiveden(), ct);
        var area = await GetAreaAsync(client, EmptyArea);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var preview = await response.Content.ReadFromJsonAsync<AdminCityAreaBoundaryPreviewResponse>(ct);
        preview.Should().NotBeNull();
        var trail = preview.AddedTrails.Should().ContainSingle(t => t.Identifier == Tiveden).Subject;
        trail.ShareInside.Should().BeGreaterThanOrEqualTo(0.25);
        trail.Path.Should().NotBeEmpty();
        area.Boundary.Should().BeNull();
        area.Trails.Should().BeEmpty();
    }

    [Fact]
    public async Task PreviewBoundary_WithAnOpenRing_ReturnsBadRequest()
    {
        // Arrange
        List<List<double>> open = [[12.80, 57.61], [12.82, 57.61], [12.82, 57.63], [12.80, 57.63]];

        // Act
        var response = await CreateAdminClient().PostAsJsonAsync(
            $"{Route}/{EmptyArea}/boundary-preview", new SaveCityAreaBoundaryRequest { Coordinates = [[open]] }, TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetTrailPaths_ForAnUnknownArea_ReturnsNotFound()
    {
        // Act
        var response = await CreateAdminClient().GetAsync($"{Route}/no-such-area/trail-paths", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SuggestBoundary_ForAnUnknownArea_ReturnsNotFound()
    {
        // Arrange
        var client = CreateAdminClient();

        // Act
        var response = await client.GetAsync($"{Route}/no-such-area/boundary-suggestion", TestContext.Current.CancellationToken);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SuggestBoundary_AroundALinkedTrail_SavesBackAsABoundaryThatTakesItIn()
    {
        // Arrange
        var client = CreateAdminClient();
        var ct = TestContext.Current.CancellationToken;
        await client.PutAsync($"{Route}/{EmptyArea}/trails/{Tiveden}", null, ct);

        // Act
        var suggestion = await client.GetFromJsonAsync<AdminCityAreaBoundaryResponse>($"{Route}/{EmptyArea}/boundary-suggestion", ct);
        if (suggestion is null) throw new InvalidOperationException("expected a suggestion");
        var saved = await client.PutAsJsonAsync(
            $"{Route}/{EmptyArea}/boundary",
            new SaveCityAreaBoundaryRequest
            {
                Coordinates = suggestion.Coordinates
                    .Select(polygon => polygon.Select(ring => ring.Select(position => position.ToList()).ToList()).ToList())
                    .ToList(),
            },
            ct);
        var area = await GetAreaAsync(client, EmptyArea);

        // Assert
        saved.StatusCode.Should().Be(HttpStatusCode.NoContent);
        area.Boundary.Should().NotBeNull();
        area.Trails.Should().Contain(t => t.Identifier == Tiveden);
    }
}
